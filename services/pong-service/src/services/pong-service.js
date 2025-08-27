const { open } = require('sqlite');
const sqlite3 = require('sqlite3').verbose();
const { validateToken } = require('../utils/auth');
const { PongGame } = require('../game/pong-game');
const { setupRoutes } = require('../routes/pong-routes');

class PongService {
  constructor(fastify) {
    this.fastify = fastify;
    this.db = null;
    this.gameRooms = new Map();
  }

  async init() {
    try {
      await this.connectDatabase();
      await this.setupRoutes();
      await this.startServer();
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

  createGame(gameId, options) {
    const game = new PongGame(gameId, this.db, options);
    this.gameRooms.set(gameId, game);
    return game;
  }
}

module.exports = { PongService };
