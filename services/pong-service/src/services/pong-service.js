// services/pong-service.js (updated)
const { open } = require('sqlite');
const sqlite3 = require('sqlite3').verbose();
const { validateToken } = require('../utils/auth');
const { PongGame } = require('../game/pong-game');
const { Tournament } = require('../game/tournament');
const { setupRoutes } = require('../routes/pong-routes');

class PongService {
  constructor(fastify) {
    this.fastify = fastify;
    this.db = null;
    this.gameRooms = new Map();
    this.tournaments = new Map();
    this.userConnections = new Map();
    this.matchmakingQueue = new Set();
    this.isProcessingMatchMaking = false;
    this.startQueueCleanup();
  }

  async init() {
    try {
      await this.connectDatabase();
      await this.setupRoutes();
      await this.startServer();
      this.startMatchmakingPoller();
    } catch (error) {
      console.error('Failed to initialize pong service:', error);
      throw error;
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

  async setupRoutes() {
    await this.fastify.register(require('@fastify/cors'), {
      origin: true,
      credentials: true
    });
    setupRoutes(this.fastify, this);
  }

  async startServer() {
    try {
      const port = process.env.PONG_PORT || 3004;
      await this.fastify.listen({ 
        port, 
        host: '0.0.0.0'
      });
      const address = this.fastify.server.address();
      console.log(`PONG service running on ${address.address}:${address.port} (${address.family}, HTTPS)`);
    } catch (error) {
      console.error('Failed to start server:', error);
      throw error;
    }
  }

  async createGame(gameId, options) {
    const game = new PongGame(gameId, this.db, options, this);
    this.gameRooms.set(gameId, game);
    return game;
  }

  createTournament(tournamentId, options) {
    const tournament = new Tournament(tournamentId, this.db, options, this);
    this.tournaments.set(tournamentId, tournament);
    return tournament;
  }

  async addUserConnection(userId, connection) {
    this.userConnections.set(userId, connection);
    await this.db.run('INSERT OR REPLACE INTO user_presence (user_id, status, last_seen_at) VALUES (?, ?, CURRENT_TIMESTAMP)', [userId, 'online']);
  }

  async removeUserConnection(userId) {
    this.userConnections.delete(userId);
    await this.db.run('UPDATE user_presence SET status = ?, last_seen_at = CURRENT_TIMESTAMP WHERE user_id = ?', ['offline', userId]);
  }

  sendToUser(userId, message) {
    const connection = this.userConnections.get(userId);
    if (connection && connection.readyState === 1) {
      connection.send(JSON.stringify(message));
    }
  }

  startMatchmakingPoller() {
    setInterval(async () => {
      if (this.isProcessingMatchMaking) return;
      if (this.matchmakingQueue.size === 0) return;

      this.isProcessingMatchMaking = true;
      try {
        await this.processMatchmaking();
      } catch (error) {
        console.error('Matchmaking error: ', error);
      } finally {
        this.isProcessingMatchMaking = false;
      }
    }, 5000);
  }

  async processMatchmaking() {
    try {

      const userIds = Array.from(this.matchmakingQueue);
      if (userIds.length === 0) return ;

      const placeholders = userIds.map(() => '?').join(',');
      const candidates = await this.db.all(`
        SELECT * FROM matchmaking_queue 
        WHERE user_id IN (${placeholders})
        AND status = 'searching' 
        ORDER BY queue_joined_at
      `, userIds);

      const groups = new Map();

      for (const candidate of candidates) {
        const settingsObj = typeof candidate.preferred_game_settings === 'string'
          ? JSON.parse(candidate.preferred_game_settings)
          : candidate.preferred_game_settings;

        const matchmakingSettings = {
          powerups_enabled: settingsObj.powerups_enabled,
          points_to_win: settingsObj.points_to_win,
          board_variant: settingsObj.board_variant,
        };

        const key = JSON.stringify(matchmakingSettings);
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key).push(candidate);
      }

      for (const [key, group] of groups) {
        while (group.length >= 2) {
          const player1 = group.shift();
          const player2 = group.shift();

          const settings = JSON.parse(key);

          const gameResult = await this.db.run(`
            INSERT INTO game_sessions (status, game_settings, created_at) 
            VALUES ('waiting', ?, CURRENT_TIMESTAMP)
          `, [JSON.stringify(settings)]);

          const gameId = gameResult.lastID;

          await this.db.run(`
            INSERT INTO game_participants (game_session_id, user_id, player_number) 
            VALUES (?, ?, 1), (?, ?, 2)
          `, [gameId, player1.user_id, gameId, player2.user_id]);


          const player1Name = await this.getDisplayName(player1.user_id);
          const player2Name = await this.getDisplayName(player2.user_id);

          this.createGame(gameId, {
             ...settings, 
             player1_name: player1Name, 
             player2_name: player2Name, 
             gameType: '2player', 
             gameMode: 'online' 
          });

          await this.db.run(`
            UPDATE matchmaking_queue 
            SET status = 'matched', matched_with_user_id = ? 
            WHERE id = ?
          `, [player2.user_id, player1.id]);

          await this.db.run(`
            UPDATE matchmaking_queue 
            SET status = 'matched', matched_with_user_id = ? 
            WHERE id = ?
          `, [player1.user_id, player2.id]);

          this.sendToUser(player1.user_id, {
            type: 'match_found',
            game_id: gameId,
            opponent_id: player2.user_id,
            opponent_name: player2Name
          });

          this.sendToUser(player2.user_id, {
            type: 'match_found',
            game_id: gameId,
            opponent_id: player1.user_id,
            opponent_name: player1Name
          });
        }
      }
    } catch (error) {
      console.error('Matchmaking processing error:', error);
    }
  }

  async removeUserFromQueue(userId) {
    try {
      await this.db.run(`
        DELETE FROM matchmaking_queue WHERE user_id = ?
      `, [userId]);
      
      this.matchmakingQueue.delete(userId);
    } catch (error) {
      console.error('Error removing user from queue:', error);
    }
  }

  startQueueCleanup() {
    setInterval(async () => {
      try {
        await this.db.run(`
          DELETE FROM matchmaking_queue 
          WHERE queue_joined_at < datetime('now', '-10 minutes')
          OR status != 'searching'
        `);
        
        const staleUsers = await this.db.all(`
          SELECT user_id FROM matchmaking_queue 
          WHERE queue_joined_at < datetime('now', '-10 minutes')
        `);
        
        staleUsers.forEach(user => {
          this.matchmakingQueue.delete(user.user_id);
        });
      } catch (error) {
        console.error('Queue cleanup error:', error);
      }
    }, 60000);
  }

  async getDisplayName(userId) {
    const user = await this.db.get('SELECT display_name FROM users WHERE id = ?', [userId]);
    return user ? user.display_name : 'Anonymous';
  }
}

module.exports = { PongService };
