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
    this.pendingInvitations = new Map();
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
      const port = process.env.PONG_PORT || 3003;
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

    this.broadcastToAllUsers({
      type: 'tournament_created',
      tournament: {
        id: tournamentId,
        name: options.tournament_settings.name,
        max_participants: options.tournament_settings.max_participants,
        current_participants: 1,
        status: 'registration'
      }
    });
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

  broadcastToAllUsers(message) {
    for (const [userId, connection] of this.userConnections) {
      if (connection.readyState === 1) {
        connection.send(JSON.stringify(message));
      }
    }
  }

  async notifyFriendRequestSent(requesterId, addresseeId, requestId) {
    const requester = await this.db.get('SELECT display_name, avatar_url FROM users WHERE id = ?', [requesterId]);
    this.sendToUser(addresseeId, {
      type: 'friend_request_received',
      from_user: {
        id: requesterId,
        display_name: requester.display_name,
        avatar_url: requester.avatar_url
      },
      request_id: requestId
    });
  }

  async notifyFriendRequestAccepted(requesterId, addresseeId) {
    const addressee = await this.db.get('SELECT id, display_name, avatar_url FROM users WHERE id = ?', [addresseeId]);
    this.sendToUser(requesterId, {
      type: 'friend_request_accepted',
      friend: {
        id: addressee.id,
        display_name: addressee.display_name,
        avatar_url: addressee.avatar_url
      }
    });
  }

  async notifyFriendRequestRejected(requesterId, addresseeId) {
    this.sendToUser(requesterId, {
      type: 'friend_request_rejected',
      addressee_id: addresseeId
    });
  }

  async handleGameInvitation(userId, data) {
    const { game_id, inviter_id, inviter_name, game_settings } = data;
    
    const invitations = this.pendingInvitations.get(userId) || [];
    invitations.push({
      game_id,
      inviter_id,
      inviter_name,
      game_settings,
      timestamp: Date.now()
    });
    this.pendingInvitations.set(userId, invitations);
    
    this.sendToUser(userId, {
      type: 'game_invitation_received',
      game_id,
      inviter_name,
      game_settings
    });
  }

  async acceptGameInvitation(userId, gameId) {
    const invitations = this.pendingInvitations.get(userId) || [];
    const invitation = invitations.find(inv => inv.game_id === gameId);
 
    if (!invitation) {
      throw new Error('Invitation not found');
    }
    const game = await this.db.get('SELECT * FROM game_sessions WHERE id = ? AND status = "waiting"', [gameId]);
    if (!game) {
      throw new Error('Invalid game');
    }
    const participant = await this.db.get(
      'SELECT * FROM game_participants WHERE game_session_id = ? AND user_id = ?',
      [gameId, userId]
    );
    if (!participant) {
      throw new Error('Not invited to this game');
    }
    await this.db.run('UPDATE game_sessions SET status = "in_progress" WHERE id = ?', [gameId]);
    
    this.pendingInvitations.set(userId, invitations.filter(inv => inv.game_id !== gameId));
    
    const inviter = await this.db.get(
      'SELECT user_id FROM game_participants WHERE game_session_id = ?',
      [gameId]
    );

    this.sendToUser(inviter.user_id, {
      type: 'game_invitation_accepted',
      game_id: gameId
    });

    this.sendToUser(userId, {
      type: 'game_invitation_accepted',
      game_id: gameId
    });

    const gameRoom = this.gameRooms.get(gameId);
    if (gameRoom) {
      //might need to get back to this
    }

    return gameId;
  }

  async declineGameInvitation(userId, gameId) {
    const invitations = this.pendingInvitations.get(userId) || [];
    const invitation = invitations.find(inv => inv.game_id === gameId);
    
    if (!invitation) {
      throw new Error('Invitation not found');
    }

    const game = await this.db.get('SELECT * FROM game_sessions WHERE id = ? AND status = "waiting"', [gameId]);
    if (!game) {
      throw new Error('Invalid game');
    }

    const participant = await this.db.get(
      'SELECT * FROM game_participants WHERE game_session_id = ? AND user_id = ? AND player_number = 2',
      [gameId, userId]
    );
    if (!participant) {
      throw new Error('Not invited to this game');
    }
    this.pendingInvitations.set(userId, invitations.filter(inv => inv.game_id !== gameId));

    // await this.db.run('UPDATE game_sessions SET status = "cancelled" WHERE id = ?', [gameId]);
    await this.db.run('UPDATE game_sessions SET status = "abandoned" WHERE id = ?', [gameId]);
    this.gameRooms.delete(gameId);

    const inviter = await this.db.get(
      'SELECT user_id FROM game_participants WHERE game_session_id = ? AND player_number = 1',
      [gameId]
    );

    this.sendToUser(inviter.user_id, {
      type: 'game_invitation_declined',
      game_id: gameId
    });
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
