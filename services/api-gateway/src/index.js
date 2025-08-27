const APIGateway = require('./app');

class APIGatewayServer {
  constructor() {
    this.gateway = new APIGateway();
  }

  async start() {
    try {
      await this.gateway.init();
    } catch (error) {
      console.error('Failed to start API Gateway:', error);
      process.exit(1);
    }
  }

  async stop() {
    try {
      await this.gateway.shutdown();
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

process.on('SIGINT', async () => {
  console.log('\nShutting down API Gateway...');
  const server = new APIGatewayServer();
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down API Gateway...');
  const server = new APIGatewayServer();
  await server.stop();
  process.exit(0);
});

const server = new APIGatewayServer();
server.start();
