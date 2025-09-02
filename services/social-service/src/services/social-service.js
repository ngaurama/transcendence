const { open } = require('sqlite');
const sqlite3 = require('sqlite3').verbose();
const { setupRoutes } = require('../routes');

class SocialService {
    constructor(fastify) {
        this.fastify = fastify;
        this.db = null;
    }

    async init() {
        try {
            await this.connectDatabase();
            await this.setupRoutes();
            await this.startServer();
        } catch (error) {
            console.error('Failed to initialize social service:', error);
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
            console.log("PORT: ", process.env.SOCIAL_PORT);
            const port = process.env.SOCIAL_PORT || 3002;
            await this.fastify.listen({ 
                port, 
                host: '0.0.0.0'
            });
            const address = this.fastify.server.address();
            console.log(`Social service running on ${address.address}:${address.port} (${address.family}, HTTPS)`);
        } catch (error) {
            console.error('Failed to start server:', error);
            throw error;
        }
    }
}

module.exports = { SocialService };
