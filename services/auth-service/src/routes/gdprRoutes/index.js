function setupGDPRRoutes(fastify, { dbService, authenticateToken }) {
  fastify.delete("/account", { preHandler: authenticateToken }, async (req, reply) => {
    try {
      const userId = req.user.user_id;

      await dbService.db.run(
        `
        UPDATE users 
        SET 
          deletion_requested_at = datetime('now'),
          is_active = FALSE
        WHERE id = ?
      `,
        [userId]
      );

      await dbService.db.run(
        `
        DELETE FROM user_sessions 
        WHERE user_id = ?
      `,
        [userId]
      );

      return {
        success: true,
        message: "Account deletion requested. Data will be erased in 30 days.",
      };
    } catch (error) {
      console.error("Account deletion error:", error);
      return reply.code(500).send({ error: "Account deletion failed" });
    }
  });

  fastify.post("/anonymize", { preHandler: authenticateToken }, async (req, reply) => {
    try {
      const userId = req.user.user_id;

      await dbService.db.run(
        `
        UPDATE users 
        SET 
          username = 'user_' || hex(randomblob(4)),
          email = 'anon_' || hex(randomblob(4)) || '@deleted.invalid',
          display_name = 'Deleted User',
          avatar_url = '/avatars/deleted.png',
          password_hash = NULL,
          google_id = NULL,
          github_id = NULL,
          data_anonymized = TRUE,
          anonymization_requested_at = datetime('now'),
          is_active = FALSE
        WHERE id = ?
      `,
        [userId]
      );

      return { success: true, message: "Account anonymized." };
    } catch (error) {
      console.error("Account anonymization error:", error);
      return reply.code(500).send({ error: "Account anonymization failed" });
    }
  });
}

module.exports = { setupGDPRRoutes };
