const { DatabaseConfig } = require("./databaseConfig");
const { EmailConfig } = require("./emailConfig");
const { loadSecrets } = require("./vaultConfig");
const { setupRoutes } = require("../routes");

class AuthService {
  constructor(fastify) {
    this.fastify = fastify;
    this.db = null;
    this.transporter = null;
    this.secrets = {};
    this.init();
  }

  async init() {
    try {
      await this.loadSecrets();
      await this.connectDatabase();
      await this.setupEmailService();
      await this.fastify.register(require('@fastify/multipart'));
      await this.setupRoutes();
      await this.startServer();
    } catch (error) {
      console.error("Failed to initialize auth service:", error);
      process.exit(1);
    }
  }

  async loadSecrets() {
    this.secrets = await loadSecrets();
  }

  async connectDatabase() {
    this.db = new DatabaseConfig(this.secrets.database.config.path);
    await this.db.connect();
  }

  async setupEmailService() {
    this.transporter = new EmailConfig(this.secrets.external.smtp);
    await this.transporter.verify();
  }

  async setupRoutes() {

    setupRoutes(this.fastify, {
      dbService: this.db,
      emailService: this.transporter,
      secrets: this.secrets,
    });
  }

  async startServer() {
    try {
      const port = process.env.AUTH_PORT || 3001;
      await this.fastify.listen({ 
        port, 
        host: '0.0.0.0'
      });
      const address = this.fastify.server.address();
      console.log(`Auth service running on ${address.address}:${address.port} (${address.family}, HTTPS)`);
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

module.exports = { AuthService };
