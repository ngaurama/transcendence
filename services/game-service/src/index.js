const Fastify = require('fastify');
const websocket = require('@fastify/websocket');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const TournamentFactory = require('./TournamentFactory');
const fsSync = require("fs");
const path = require('path');

const keyPath = path.resolve('/app/certs/server.key');
const certPath = path.resolve('/app/certs/server.crt');

const fastify = Fastify({
  logger: true,
  https: {
    key: fsSync.readFileSync(keyPath, 'utf8'),
    cert: fsSync.readFileSync(certPath, 'utf8')
  }
});

class GameService {
  constructor() {
    this.db = null;
    this.gameRooms = new Map();
    this.tournaments = new Map();
    this.matchmakingQueue = [];
    this.init();
  }

  async init() {
    try {
        await this.connectDatabase();
      await this.setupWebSocket();
      await this.setupRoutes();
      await this.startMatchmakingLoop();
      await this.startServer();
    } catch (error) {
      console.error('Failed to initialize game service:', error);
      process.exit(1);
    }
  }

  async connectDatabase() {
    try {
      this.db = await open({
        filename: '/app/data/ft_transcendence.db',
        driver: sqlite3.Database
      });
      console.log('Connected to db');
    } catch (error) {
      console.error('Db connection failed:', error);
      throw error;
    }
  }

  async setupWebSocket() {
    await fastify.register(websocket);
  }

  setupRoutes() {
    fastify.register(require('@fastify/cors'), {
      origin: true,
      credentials: true
    });

    fastify.get('/health', async (request, reply) => {
      return { 
        status: 'healthy', 
        service: 'game-service',
        active_games: this.gameRooms.size,
        active_tournaments: this.tournaments.size,
        matchmaking_queue: this.matchmakingQueue.length
      };
    });

    fastify.get('/public-games/:gameType', async (request, reply) => {
      try {
        const { gameType } = request.params;
        const gameTypeRecord = await this.db.get('SELECT id FROM game_types WHERE name = ?', [gameType]);
        if (!gameTypeRecord) {
          return reply.code(400).send({ error: 'Invalid game type' });
        }

        const publicGames = await this.db.all(`
          SELECT 
            gs.id,
            gt.name as game_type,
            gs.status,
            gs.max_players,
            COUNT(gp.user_id) as current_players,
            gs.created_at
          FROM game_sessions gs
          LEFT JOIN game_participants gp ON gs.id = gp.game_session_id
          JOIN game_types gt ON gs.game_type_id = gt.id
          WHERE gs.status = 'waiting' 
            AND gs.tournament_id IS NULL
            AND gt.name = ?
          GROUP BY gs.id
          HAVING current_players < gs.max_players
          ORDER BY gs.created_at DESC
          LIMIT 10
        `, [gameType]);

        return { games: publicGames };
      } catch (error) {
        console.error('Error fetching public games:', error);
        return reply.code(500).send({ error: 'Failed to fetch games' });
      }
    });

    fastify.post('/join', async (request, reply) => {
      try {
        const userId = request.headers['x-user-id'];
        const { game_id } = request.body;

        if (!userId || !game_id) {
          return reply.code(400).send({ error: 'Missing required fields' });
        }

        const game = await this.db.get(`
          SELECT 
            gs.*,
            COUNT(gp.user_id) as current_players
          FROM game_sessions gs
          LEFT JOIN game_participants gp ON gs.id = gp.game_session_id
          WHERE gs.id = ? AND gs.status = 'waiting'
          GROUP BY gs.id
        `, [game_id]);

        if (!game) {
          return reply.code(404).send({ error: 'Game not found or not available' });
        }

        if (game.current_players >= game.max_players) {
          return reply.code(400).send({ error: 'Game is full' });
        }

        const existingParticipant = await this.db.get(`
          SELECT 1 FROM game_participants 
          WHERE game_session_id = ? AND user_id = ?
        `, [game_id, userId]);

        if (existingParticipant) {
          return reply.code(400).send({ error: 'Already joined this game' });
        }

        const playerNumber = game.current_players + 1;
        await this.db.run(`
          INSERT INTO game_participants (
            game_session_id, user_id, player_number, joined_at
          ) VALUES (?, ?, ?, datetime('now'))
        `, [game_id, userId, playerNumber]);

        const gameRoom = this.gameRooms.get(game_id);
        if (gameRoom) {
          gameRoom.addPlayer(userId, playerNumber);
          
          if (playerNumber >= game.max_players) {
            await this.startGame(game_id);
          }
        }

        return { 
          success: true, 
          message: 'Joined game successfully',
          player_number: playerNumber
        };
      } catch (error) {
        console.error('Error joining game:', error);
        return reply.code(500).send({ error: 'Failed to join game' });
      }
    });

    fastify.post('/tournament/create', async (request, reply) => {
      try {
        const userId = request.headers['x-user-id'];
        const { name, max_participants = 8, tournament_type = 'single_elimination', game_type, settings = {} } = request.body;

        if (!userId || !name || !game_type) {
          return reply.code(400).send({ error: 'Missing required fields' });
        }

        const gameTypeRecord = await this.db.get('SELECT id FROM game_types WHERE name = ?', [game_type]);
        if (!gameTypeRecord) {
          return reply.code(400).send({ error: 'Invalid game type' });
        }

        const result = await this.db.run(`
            INSERT INTO tournaments (
            name, game_type_id, max_participants, type, status,
            creator_id, tournament_settings, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `, [name, gameTypeRecord.id, max_participants, tournament_type, 'registration', userId, JSON.stringify(settings)]);

        const tournamentId = result.lastID;

        await this.db.run(`
          INSERT INTO tournament_participants (
            tournament_id, user_id, joined_at
          ) VALUES (?, ?, datetime('now'))
        `, [tournamentId, userId]);

        this.tournaments.set(tournamentId, TournamentFactory.create(tournamentId, {
          name,
          tournament_type,
          max_participants,
          game_type,
          creator_id: userId
        }));

        return { 
          success: true, 
          tournament_id: tournamentId,
          message: 'Tournament created successfully'
        };
      } catch (error) {
        console.error('Error creating tournament:', error);
        return reply.code(500).send({ error: 'Failed to create tournament' });
      }
    });

    fastify.get('/tournament/:id', async (request, reply) => {
      try {
        const tournamentId = request.params.id;

        const tournament = await this.db.get(`
          SELECT 
            t.*,
            u.username as creator_username,
            gt.name as game_type,
            COUNT(tp.user_id) as current_participants
          FROM tournaments t
          JOIN users u ON t.creator_id = u.id
          JOIN game_types gt ON t.game_type_id = gt.id
          LEFT JOIN tournament_participants tp ON t.id = tp.tournament_id
          WHERE t.id = ?
          GROUP BY t.id
        `, [tournamentId]);

        if (!tournament) {
          return reply.code(404).send({ error: 'Tournament not found' });
        }

        const participants = await this.db.all(`
          SELECT 
            tp.*,
            u.username,
            u.display_name
          FROM tournament_participants tp
          JOIN users u ON tp.user_id = u.id
          WHERE tp.tournament_id = ?
          ORDER BY tp.registered_at
        `, [tournamentId]);

        return {
          tournament: {
            ...tournament,
            participants
          }
        };
      } catch (error) {
        console.error('Error fetching tournament:', error);
        return reply.code(500).send({ error: 'Failed to fetch tournament' });
      }
    });

    fastify.post('/matchmaking/join', async (request, reply) => {
      try {
        const userId = request.headers['x-user-id'];
        const { game_type, skill_range = 'any' } = request.body;

        if (!userId || !game_type) {
          return reply.code(401).send({ error: 'Missing required fields' });
        }

        const gameTypeRecord = await this.db.get('SELECT id FROM game_types WHERE name = ?', [game_type]);
        if (!gameTypeRecord) {
          return reply.code(400).send({ error: 'Invalid game type' });
        }

        const existingIndex = this.matchmakingQueue.findIndex(
          player => player.user_id === userId
        );

        if (existingIndex !== -1) {
          return reply.code(400).send({ error: 'Already in matchmaking queue' });
        }

        await this.db.run(`
          INSERT INTO matchmaking_queue (
            user_id, game_type_id, skill_rating, status, queue_joined_at
          ) VALUES (?, ?, ?, ?, datetime('now'))
        `, [userId, gameTypeRecord.id, skill_range === 'any' ? 1000 : skill_range, 'searching']);

        this.matchmakingQueue.push({
          user_id: userId,
          game_type_id: gameTypeRecord.id,
          skill_range,
          joined_at: Date.now()
        });

        return { 
          success: true, 
          message: 'Added to matchmaking queue',
          queue_position: this.matchmakingQueue.length
        };
      } catch (error) {
        console.error('Error joining matchmaking:', error);
        return reply.code(500).send({ error: 'Failed to join matchmaking' });
      }
    });

    fastify.get('/wss', { websocket: true }, (connection, request) => {
      let authenticated = false;
      let userId = null;
      let gameId = null;
      
      const authTimeout = setTimeout(() => {
          if (!authenticated) {
              connection.socket.close(4001, 'Authentication timeout');
          }
      }, 5000);

      connection.socket.on('message', (message) => {
          try {
              const data = JSON.parse(message.toString());
              if (data.type === 'auth' && data.token) {
                  validateToken(data.token).then(user => {
                      if (user) {
                          authenticated = true;
                          userId = user.id;
                          clearTimeout(authTimeout);
                          
                          gameId = request.query.game_id;
                          if (!gameId) {
                              connection.socket.close(4000, 'Game ID required');
                              return;
                          }

                          const gameRoom = this.gameRooms.get(parseInt(gameId));
                          if (!gameRoom) {
                              connection.socket.close(4004, 'Game not found');
                              return;
                          }

                          gameRoom.addConnection(userId, connection.socket);
                      } else {
                          connection.socket.close(4002, 'Invalid token');
                      }
                  });
              }
              else if (authenticated) {
                  const gameRoom = this.gameRooms.get(parseInt(gameId));
                  if (gameRoom) {
                      gameRoom.handlePlayerInput(userId, data);
                  }
              }
          } catch (error) {
              console.error('Invalid WebSocket message:', error);
          }
      });

      connection.socket.on('close', () => {
          clearTimeout(authTimeout);
          if (authenticated && gameId) {
              const gameRoom = this.gameRooms.get(parseInt(gameId));
              if (gameRoom) {
                  gameRoom.removeConnection(userId);
              }
          }
      });
    });

    fastify.post('/tournament/join', async (request, reply) => {
      try {
        const userId = request.headers['x-user-id'];
        const { tournament_id } = request.body;

        if (!userId || !tournament_id) {
          return reply.code(400).send({ error: 'Missing required fields' });
        }

        const tournament = await this.db.get(`
          SELECT * FROM tournaments 
          WHERE id = ? AND status = 'registration'
        `, [tournament_id]);

        if (!tournament) {
          return reply.code(404).send({ error: 'Tournament not found or not accepting participants' });
        }

        const existingParticipant = await this.db.get(`
          SELECT 1 FROM tournament_participants 
          WHERE tournament_id = ? AND user_id = ?
        `, [tournament_id, userId]);

        if (existingParticipant) {
          return reply.code(400).send({ error: 'Already joined this tournament' });
        }

        const tournamentInstance = this.tournaments.get(parseInt(tournament_id));
        if (tournamentInstance) {
          await tournamentInstance.addParticipant(userId);
        }

        await this.db.run(`
          INSERT INTO tournament_participants (
            tournament_id, user_id, joined_at
          ) VALUES (?, ?, datetime('now'))
        `, [tournament_id, userId]);

        await this.db.run(`
          UPDATE tournaments 
          SET current_participants = current_participants + 1
          WHERE id = ?
        `, [tournament_id]);

        return { 
          success: true, 
          message: 'Joined tournament successfully',
          current_participants: tournament.current_participants + 1
        };
      } catch (error) {
        console.error('Error joining tournament:', error);
        return reply.code(500).send({ error: error.message || 'Failed to join tournament' });
      }
    });

    fastify.post('/tournament/start', async (request, reply) => {
      try {
        const userId = request.headers['x-user-id'];
        const { tournament_id } = request.body;

        if (!userId || !tournament_id) {
          return reply.code(400).send({ error: 'Missing required fields' });
        }

        const tournament = await this.db.get(`
          SELECT * FROM tournaments 
          WHERE id = ? AND creator_id = ?
        `, [tournament_id, userId]);

        if (!tournament) {
          return reply.code(404).send({ error: 'Tournament not found or you are not the creator' });
        }

        if (tournament.status !== 'registration') {
          return reply.code(400).send({ error: 'Tournament has already started' });
        }

        const participantCount = await this.db.get(`
          SELECT COUNT(*) as count FROM tournament_participants 
          WHERE tournament_id = ?
        `, [tournament_id]);

        if (participantCount.count < 2) {
          return reply.code(400).send({ error: 'Not enough participants to start tournament' });
        }

        const tournamentInstance = this.tournaments.get(parseInt(tournament_id));
        if (tournamentInstance) {
          await tournamentInstance.startTournament();
        }

        await this.db.run(`
          UPDATE tournaments 
          SET status = 'in_progress', 
              starts_at = datetime('now'),
              current_round = 1,
              total_rounds = ?
          WHERE id = ?
        `, [tournamentInstance.totalRounds, tournament_id]);

        // Create initial matches in database
        const bracket = tournamentInstance.getBracket();
        for (const match of bracket.matches) {
          await this.db.run(`
            INSERT INTO tournament_matches (
              tournament_id, round_number, match_number,
              player1_id, player2_id, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          `, [
            tournament_id,
            match.round,
            match.match_number,
            match.player1,
            match.player2,
            match.status
          ]);
        }

        return { 
          success: true, 
          message: 'Tournament started successfully',
          current_round: 1
        };
      } catch (error) {
        console.error('Error starting tournament:', error);
        return reply.code(500).send({ error: error.message || 'Failed to start tournament' });
      }
    });

    fastify.post('/tournament/record-result', async (request, reply) => {
      try {
        const userId = request.headers['x-user-id'];
        const { tournament_id, match_id, winner_id } = request.body;

        if (!userId || !tournament_id || !match_id || !winner_id) {
          return reply.code(400).send({ error: 'Missing required fields' });
        }

        // Verify the user has permission to record this result
        // (In a real app, this would be more sophisticated)
        const tournament = await this.db.get(`
          SELECT * FROM tournaments 
          WHERE id = ? AND status = 'in_progress'
        `, [tournament_id]);

        if (!tournament) {
          return reply.code(404).send({ error: 'Tournament not found or not in progress' });
        }

        const match = await this.db.get(`
          SELECT * FROM tournament_matches 
          WHERE id = ? AND tournament_id = ? AND status = 'pending'
        `, [match_id, tournament_id]);

        if (!match) {
          return reply.code(404).send({ error: 'Match not found or already completed' });
        }

        if (match.player1_id !== winner_id && match.player2_id !== winner_id) {
          return reply.code(400).send({ error: 'Winner must be one of the match participants' });
        }

        const tournamentInstance = this.tournaments.get(parseInt(tournament_id));
        if (tournamentInstance) {
          await tournamentInstance.recordMatchResult(match_id, winner_id);
        }

        // Update match in database
        await this.db.run(`
          UPDATE tournament_matches 
          SET winner_id = ?, 
              status = 'completed',
              completed_at = datetime('now')
          WHERE id = ?
        `, [winner_id, match_id]);

        // Update participant as eliminated if needed
        const loserId = match.player1_id === winner_id ? match.player2_id : match.player1_id;
        if (loserId) {
          await this.db.run(`
            UPDATE tournament_participants 
            SET is_eliminated = TRUE,
                eliminated_in_round = ?
            WHERE tournament_id = ? AND user_id = ?
          `, [match.round_number, tournament_id, loserId]);
        }

        // Check if round is complete and advance if needed
        const currentRoundMatches = await this.db.all(`
          SELECT * FROM tournament_matches 
          WHERE tournament_id = ? AND round_number = ?
        `, [tournament_id, tournament.current_round]);

        const incompleteMatches = currentRoundMatches.filter(m => m.status !== 'completed');
        if (incompleteMatches.length === 0) {
          // Advance to next round
          await tournamentInstance.advanceRound();
          
          if (tournamentInstance.status === 'completed') {
            // Tournament is over
            await this.db.run(`
              UPDATE tournaments 
              SET status = 'completed',
                  winner_id = ?,
                  ends_at = datetime('now')
              WHERE id = ?
            `, [winner_id, tournament_id]);
          } else {
            // Create next round matches
            const nextRound = tournament.current_round + 1;
            const winners = currentRoundMatches.map(m => m.winner_id);
            
            // Create matches for next round
            let matchNumber = 1;
            for (let i = 0; i < winners.length; i += 2) {
              if (i + 1 < winners.length) {
                await this.db.run(`
                  INSERT INTO tournament_matches (
                    tournament_id, round_number, match_number,
                    player1_id, player2_id, status, created_at
                  ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                `, [
                  tournament_id,
                  nextRound,
                  matchNumber++,
                  winners[i],
                  winners[i + 1],
                  'pending'
                ]);
              } else {
                await this.db.run(`
                  INSERT INTO tournament_matches (
                    tournament_id, round_number, match_number,
                    player1_id, winner_id, status, completed_at, created_at
                  ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                `, [
                  tournament_id,
                  nextRound,
                  matchNumber++,
                  winners[i],
                  winners[i],
                  'completed'
                ]);
              }
            }

            await this.db.run(`
              UPDATE tournaments 
              SET current_round = ?
              WHERE id = ?
            `, [nextRound, tournament_id]);
          }
        }

        return { 
          success: true, 
          message: 'Match result recorded successfully',
          tournament_status: tournamentInstance.status
        };
      } catch (error) {
        console.error('Error recording tournament result:', error);
        return reply.code(500).send({ error: error.message || 'Failed to record result' });
      }
    });

    fastify.get('/tournament/:id/bracket', async (request, reply) => {
      try {
        const tournamentId = request.params.id;

        const tournament = await this.db.get(`
          SELECT * FROM tournaments WHERE id = ?
        `, [tournamentId]);

        if (!tournament) {
          return reply.code(404).send({ error: 'Tournament not found' });
        }

        const participants = await this.db.all(`
          SELECT 
            tp.*,
            u.username,
            u.display_name
          FROM tournament_participants tp
          JOIN users u ON tp.user_id = u.id
          WHERE tp.tournament_id = ?
          ORDER BY tp.joined_at
        `, [tournamentId]);

        const matches = await this.db.all(`
          SELECT * FROM tournament_matches
          WHERE tournament_id = ?
          ORDER BY round_number, match_number
        `, [tournamentId]);

        return {
          tournament: {
            ...tournament,
            participants,
            matches
          }
        };
      } catch (error) {
        console.error('Error fetching tournament bracket:', error);
        return reply.code(500).send({ error: 'Failed to fetch tournament bracket' });
      }
    });

  }

  async startGame(gameId) {
    try {
      await this.db.run(`
        UPDATE game_sessions 
        SET status = 'in_progress', started_at = datetime('now')
        WHERE id = ?
      `, [gameId]);

      const gameRoom = this.gameRooms.get(gameId);
      if (gameRoom) {
        gameRoom.start();
      }

      console.log(`Game ${gameId} started`);
    } catch (error) {
      console.error('Error starting game:', error);
    }
  }

  async startMatchmakingLoop() {
    setInterval(() => {
      this.processMatchmakingQueue();
    }, 5000);
  }

  async processMatchmakingQueue() {
    if (this.matchmakingQueue.length < 2) return;

    const groupedByGameType = {};
    this.matchmakingQueue.forEach(player => {
      if (!groupedByGameType[player.game_type_id]) {
        groupedByGameType[player.game_type_id] = [];
      }
      groupedByGameType[player.game_type_id].push(player);
    });

    for (const gameTypeId in groupedByGameType) {
      const players = groupedByGameType[gameTypeId];
      if (players.length >= 2) {
        const player1 = players[0];
        const player2 = players[1];

        this.matchmakingQueue = this.matchmakingQueue.filter(
          p => p.user_id !== player1.user_id && p.user_id !== player2.user_id
        );

        await this.createMatchmadeGame([player1, player2], gameTypeId);
      }
    }
  }

  async createMatchmadeGame(players, gameTypeId) {
    try {
      const gameType = await this.db.get('SELECT name FROM game_types WHERE id = ?', [gameTypeId]);
      const result = await this.db.run(`
        INSERT INTO game_sessions (
          game_type_id, status, max_players, tournament_id, created_at
        ) VALUES (?, ?, ?, NULL, datetime('now'))
      `, [gameTypeId, 'in_progress', 2]);

      const gameId = result.lastID;

      for (let i = 0; i < players.length; i++) {
        await this.db.run(`
          INSERT INTO game_participants (
            game_session_id, user_id, player_number, joined_at
          ) VALUES (?, ?, ?, datetime('now'))
        `, [gameId, players[i].user_id, i + 1]);

        await this.db.run(`
          DELETE FROM matchmaking_queue WHERE user_id = ?
        `, [players[i].user_id]);
      }

      this.gameRooms.set(gameId, new GameRoom(gameId, { max_players: 2, game_type: gameType.name }));
      
      console.log(`Matchmade game ${gameId} created for game type ${gameType.name} with players: ${players.map(p => p.user_id).join(', ')}`);

    } catch (error) {
      console.error('Error creating matchmade game:', error);
    }
  }

  async startServer() {
    try {
      const port = process.env.GAME_PORT || 3002;
      
      await fastify.listen({ 
        port, 
        host: '0.0.0.0'
      });
      
      const address = fastify.server.address();
      console.log(`Game service running on ${address.address}:${address.port} (${address.family}, HTTPS)`);
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

class GameRoom {
  constructor(gameId, options = {}) {
    this.gameId = gameId;
    this.players = new Map();
    this.connections = new Map();
    this.gameState = {
      status: 'waiting',
      game_type: options.game_type || 'unknown'
    };
    this.options = {
      max_players: options.max_players || 2
    };
  }

  addPlayer(userId, playerNumber) {
    this.players.set(userId, {
      id: userId,
      playerNumber
    });
  }

  addConnection(userId, socket) {
    this.connections.set(userId, socket);
    this.sendToPlayer(userId, {
      type: 'game_state',
      state: this.gameState
    });
  }

  removeConnection(userId) {
    this.connections.delete(userId);
    if (this.gameState.status === 'in_progress') {
      this.handlePlayerDisconnection(userId);
    }
  }

  handlePlayerInput(userId, input) {
    // Forward input to the specific game service via HTTP or message queue
    // This is a placeholder; actual implementation depends on game service communication
    this.broadcast({
      type: 'player_input',
      userId,
      input
    });
  }

  start() {
    this.gameState.status = 'in_progress';
    this.broadcast({ type: 'game_started' });
  }

  handlePlayerDisconnection(userId) {
    const otherPlayers = [...this.players.keys()].filter(id => id !== userId);
    
    if (otherPlayers.length > 0) {
      this.endGame(otherPlayers[0]);
    } else {
      this.gameState.status = 'abandoned';
    }
  }

  endGame(winnerId) {
    this.gameState.status = 'completed';
    this.broadcast({
      type: 'game_ended',
      winner: winnerId
    });
  }

  sendToPlayer(userId, message) {
    const connection = this.connections.get(userId);
    if (connection && connection.readyState === 1) {
      connection.send(JSON.stringify(message));
    }
  }

  broadcast(message) {
    this.connections.forEach((connection, userId) => {
      this.sendToPlayer(userId, message);
    });
  }
}

process.on('SIGINT', async () => {
  console.log('\nShutting down game service...');
  try {
    await fastify.close();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

new GameService();
