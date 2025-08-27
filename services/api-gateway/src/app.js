const Fastify = require('fastify');
const config = require('./config');
const middleware = require('./middleware');
const routes = require('./routes');
const hooks = require('./hooks');

class APIGateway {
  constructor() {
    this.fastify = Fastify({
      logger: true,
      https: {
        key: config.ssl.key,
        cert: config.ssl.cert
      }
    });
  }

  async init() {
    try {
      await this.setupMiddleware();
      await this.setupHooks();
      await this.setupRoutes();
      await this.startServer();
    } catch (error) {
      console.error('Failed to initialize API Gateway:', error);
      throw error;
    }
  }

  async setupMiddleware() {
    await middleware.setupSecurity(this.fastify);
    await middleware.setupCORS(this.fastify);
    await middleware.setupRateLimiting(this.fastify);
  }

  async setupHooks() {
    await hooks.setupRequestHooks(this.fastify);
    await hooks.setupResponseHooks(this.fastify);
  }

  async setupRoutes() {
    await routes.setupRoutes(this.fastify);
  }

  async startServer() {
    try {
      const port = config.port;
      
      await this.fastify.listen({ 
        port, 
        host: '0.0.0.0'
      });
      
      const address = this.fastify.server.address();
      console.log(`API Gateway running on ${address.address}:${address.port} (HTTPS)`);
      // console.log(`API Documentation available at ${process.env.API_URL}/api/docs`);
    } catch (error) {
      console.error('Failed to start server:', error);
      throw error;
    }
  }

  async shutdown() {
    try {
      await this.fastify.close();
      console.log('API Gateway shut down successfully');
    } catch (error) {
      console.error('Error during shutdown:', error);
      throw error;
    }
  }
}

module.exports = APIGateway;
