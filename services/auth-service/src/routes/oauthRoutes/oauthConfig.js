module.exports = function setupOAuthConfigRoute(fastify, { secrets }) {
  fastify.get("/oauth-config", async (request, reply) => {
    return {
      google: !!(secrets.external.google && secrets.external.google.client_id),
      github: !!(secrets.external.github && secrets.external.github.client_id),
      fortytwo: !!(secrets.external.fortytwo && secrets.external.fortytwo.client_id)
    };
  });
};
