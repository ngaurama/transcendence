async function setupRequestHooks(fastify) {
  fastify.addHook('onRequest', async (request, reply) => {
    request.startTime = Date.now();
  });
}

async function setupResponseHooks(fastify) {
  fastify.addHook('onResponse', async (request, reply) => {
    const duration = Date.now() - request.startTime;
    console.log(`${request.method} ${request.url} - ${reply.statusCode} - ${duration}ms`);
  });
}

module.exports = {
  setupRequestHooks,
  setupResponseHooks
};
