const { setupAuthRoutes } = require("./authRoutes");
const { setupUserRoutes } = require("./userRoutes");
const { setupOAuthRoutes } = require("./oauthRoutes");
const { setupGDPRRoutes } = require("./gdprRoutes");
const { createAuthenticateToken } = require("../middleware");
 
function setupRoutes(fastify, { dbService, emailService, secrets }) {  
  
  const authenticateToken = createAuthenticateToken(secrets, dbService);

  fastify.get("/health", async (request, reply) => {
    try {
      await dbService.db.get("SELECT 1");
      return {
        status: "healthy",
        service: "auth-service",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Health check failed:", error);
      reply.code(500);
      return { status: "unhealthy", error: error.message };
    }
  });

  fastify.get("/smtp-status", async (request, reply) => {
    return {
      configured: !emailService.isFallback,
      isFallback: !!emailService.isFallback
    };
  });

  setupAuthRoutes(fastify, { dbService, emailService, secrets, authenticateToken });
  setupUserRoutes(fastify, { dbService, emailService, secrets, authenticateToken });
  setupOAuthRoutes(fastify, { dbService, emailService, secrets });
  setupGDPRRoutes(fastify, { dbService, authenticateToken });
}

module.exports = { setupRoutes };
