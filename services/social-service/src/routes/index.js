const setupStatsRoutes = require("./stats-routes")
const setupFriendsRoutes = require("./friend-routes")
 
function setupRoutes(fastify, socialService) {  
  
  fastify.get("/health", async (request, reply) => {
    try {
      await socialService.db.get("SELECT 1");
      return {
        status: "healthy",
        service: "social-service",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Health check failed:", error);
      reply.code(500);
      return { status: "unhealthy", error: error.message };
    }
  });

  setupStatsRoutes(fastify, socialService);
  setupFriendsRoutes(fastify, socialService);
}

module.exports = { setupRoutes };
