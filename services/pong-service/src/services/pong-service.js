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
    const game = new PongGame(gameId, this.db, options);
    // await game.init();
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
      await this.processMatchmaking();
    }, 5000);
  }

  async processMatchmaking() {
    try {
      const candidates = await this.db.all(`
        SELECT * FROM matchmaking_queue 
        WHERE status = 'searching' 
        AND queue_joined_at > datetime('now', '-5 minutes')
      `);

      const groups = new Map();

      for (const candidate of candidates) {
        const key = JSON.stringify(candidate.preferred_game_settings);
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

          this.createGame(gameId, { ...settings, is_local: false });

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

          const player1Name = await this.getDisplayName(player1.user_id);
          const player2Name = await this.getDisplayName(player2.user_id);

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

  async getDisplayName(userId) {
    const user = await this.db.get('SELECT display_name FROM users WHERE id = ?', [userId]);
    return user ? user.display_name : 'Anonymous';
  }
}

module.exports = { PongService };
