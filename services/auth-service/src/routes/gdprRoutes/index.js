const path = require("path");
const fs = require("fs").promises;

function setupGDPRRoutes(fastify, { dbService, authenticateToken }) {
  fastify.get("/gdpr/export-data", { preHandler: authenticateToken }, async (req, reply) => {
    try {
      const userId = req.user.user_id;

      const userData = await dbService.db.get(
        `SELECT * FROM users WHERE id = ?`,
        [userId]
      );

      const sessions = await dbService.db.all(
        `SELECT * FROM user_sessions WHERE user_id = ?`,
        [userId]
      );

      const friendships = await dbService.db.all(
        `SELECT * FROM friendships WHERE requester_id = ? OR addressee_id = ?`,
        [userId, userId]
      );

      const gameStats = await dbService.db.all(
        `SELECT * FROM user_game_stats WHERE user_id = ?`,
        [userId]
      );

      const tournamentParticipation = await dbService.db.all(
        `SELECT * FROM tournament_participants WHERE user_id = ?`,
        [userId]
      );

      const dataExport = {
        user: userData,
        sessions,
        friendships,
        game_stats: gameStats,
        tournament_participation: tournamentParticipation,
        exported_at: new Date().toISOString()
      };

      return {
        success: true,
        data: dataExport,
        message: "Data export generated successfully"
      };
    } catch (error) {
      console.error("Data export error:", error);
      return reply.code(500).send({ error: "Data export failed" });
    }
  });

  fastify.get("/gdpr/my-data", { preHandler: authenticateToken }, async (req, reply) => {
    try {
      const userId = req.user.user_id;

      const userData = await dbService.db.get(
        `SELECT id, username, email, display_name, avatar_url, 
                is_verified, oauth_provider, totp_enabled, 
                created_at, last_login_at 
         FROM users WHERE id = ?`,
        [userId]
      );

      if (!userData) {
        return reply.code(404).send({ error: "User not found" });
      }

      return { success: true, data: userData };
    } catch (error) {
      console.error("Data retrieval error:", error);
      return reply.code(500).send({ error: "Failed to retrieve user data" });
    }
  });

  fastify.delete("/gdpr/account", { preHandler: authenticateToken }, async (req, reply) => {
    try {
      const userId = req.user.user_id;

      await dbService.db.run(
        `UPDATE users 
         SET deletion_requested_at = datetime('now')
        WHERE id = ?`,
        [userId]
      );

      await dbService.db.run(
        `DELETE FROM user_sessions WHERE user_id = ?`,
        [userId]
      );

      await dbService.db.run(
        `DELETE FROM matchmaking_queue WHERE user_id = ?`,
        [userId]
      );

      return {
        success: true,
        message: "Account deletion requested. All data will be permanently erased after 30 days.",
        deletion_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        can_cancel_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };
    } catch (error) {
      console.error("Account deletion error:", error);
      return reply.code(500).send({ error: "Account deletion failed" });
    }
  });

  fastify.post("/gdpr/anonymize", { preHandler: authenticateToken }, async (req, reply) => {
    try {
      const userId = req.user.user_id;

      await dbService.db.run(
        `UPDATE users 
         SET username = 'user_' || hex(randomblob(4)),
          email = 'anon_' || hex(randomblob(4)) || '@deleted.invalid',
          display_name = 'Deleted User',
          avatar_url = '/avatars/deleted.png',
          password_hash = NULL,
          google_id = NULL,
          github_id = NULL,
          totp_secret = NULL,
          totp_enabled = FALSE,
          backup_codes = NULL,
          data_anonymized = TRUE,
          anonymization_requested_at = datetime('now'),
          is_active = FALSE,
          updated_at = datetime('now')
         WHERE id = ?`,
        [userId]
      );

      await dbService.db.run(
        `DELETE FROM user_sessions WHERE user_id = ?`,
        [userId]
      );

      await dbService.db.run(
        `DELETE FROM matchmaking_queue WHERE user_id = ?`,
        [userId]
      );

      return { 
        success: true, 
        message: "Account successfully anonymized. All personal data has been removed." 
      };
    } catch (error) {
      console.error("Account anonymization error:", error);
      return reply.code(500).send({ error: "Account anonymization failed" });
    }
  });

  fastify.post("/gdpr/cancel-deletion", { preHandler: authenticateToken }, async (req, reply) => {
    try {
      const userId = req.user.user_id;

      await dbService.db.run(
        `UPDATE users 
         SET deletion_requested_at = NULL,
             is_active = TRUE
         WHERE id = ?`,
        [userId]
      );

      return { success: true, message: "Account deletion request cancelled" };
    } catch (error) {
      console.error("Cancel deletion error:", error);
      return reply.code(500).send({ error: "Failed to cancel deletion" });
    }
  });

  fastify.get("/gdpr/deletion-status", { preHandler: authenticateToken }, async (req, reply) => {
    try {
      const userId = req.user.user_id;
      
      const user = await dbService.db.get(
        `SELECT deletion_requested_at FROM users WHERE id = ?`,
        [userId]
      );
      
      if (user && user.deletion_requested_at) {
        const deletionDate = new Date(user.deletion_requested_at);
        deletionDate.setDate(deletionDate.getDate() + 30);
        
        return {
          pending_deletion: true,
          deletion_date: deletionDate.toISOString(),
          days_remaining: Math.ceil((deletionDate - new Date()) / (1000 * 60 * 60 * 24))
        };
      }
      
      return { pending_deletion: false };
    } catch (error) {
      console.error("Deletion status error:", error);
      return reply.code(500).send({ error: "Failed to get deletion status" });
    }
  });
}

module.exports = { setupGDPRRoutes };
