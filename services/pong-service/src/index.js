const Fastify = require('fastify');
const websocket = require('@fastify/websocket');
const path = require('path');
const fs = require('fs');
const { PongService } = require('./services/pong-service');

const keyPath = path.resolve('/app/certs/server.key');
const certPath = path.resolve('/app/certs/server.crt');

const fastify = Fastify({
  logger: true,
  https: {
    key: fs.readFileSync(keyPath, 'utf8'),
    cert: fs.readFileSync(certPath, 'utf8')
  }
});

async function start() {
  try {
    await fastify.register(websocket);
    const pongService = new PongService(fastify);
    await pongService.init();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('\nShutting down pong service...');
  try {
    await fastify.close();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

start();
