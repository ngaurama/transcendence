const healthRoutes = require('./health');
const avatarRoutes = require('./avatars');
// const docsRoutes = require('./docs');
const proxyRoutes = require('./proxies');

async function setupRoutes(fastify) {
  await fastify.register(healthRoutes);
  await fastify.register(avatarRoutes);
  // await fastify.register(docsRoutes);
  await fastify.register(proxyRoutes, { prefix: '/api' });
  setupErrorHandlers(fastify);
}

function setupErrorHandlers(fastify) {
  fastify.setNotFoundHandler(async (request, reply) => {
    return reply.code(404).send({
      error: 'Route not found',
      message: `${request.method} ${request.url} is not supported`,
      timestamp: new Date().toISOString()
    });
  });

  fastify.setErrorHandler(async (error, request, reply) => {
    console.error('API Gateway Error:', error);

    const statusCode = error.statusCode || 500;
    const errorMessage = statusCode === 500 ? 'Internal Server Error' : error.message;

    return reply.code(statusCode).send({
      error: errorMessage,
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url
    });
  });
}

module.exports = {
  setupRoutes
};
