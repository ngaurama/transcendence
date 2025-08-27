const jwt = require("jsonwebtoken");

module.exports = function setupVerifyEmailRoute(fastify, { dbService, emailService, secrets, authenticateToken }) {
  fastify.post("/verify-email", async (request, reply) => {
    try {
      const { token } = request.body;
      if (!token) return reply.code(400).send({ error: "Verification token required" });

      let decoded;
      try {
        decoded = jwt.verify(token, secrets.auth.jwt.secret);
      } catch {
        return reply.code(401).send({ error: "Invalid or expired token" });
      }

      if (decoded.action !== "verify_email") {
        return reply.code(401).send({ error: "Invalid token type" });
      }

      const verificationToken = await dbService.db.get(
        `SELECT * FROM email_verification_tokens WHERE token = ? AND user_id = ? AND expires_at > datetime('now') AND used_at IS NULL`,
        [token, decoded.user_id]
      );

      if (!verificationToken) return reply.code(401).send({ error: "Invalid or used token" });

      await dbService.db.run(
        `UPDATE users SET is_verified = 1, email_verified_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
        [decoded.user_id]
      );

      await dbService.db.run(
        `UPDATE email_verification_tokens SET used_at = datetime('now') WHERE id = ?`,
        [verificationToken.id]
      );

      return { success: true, message: "Email verified successfully", redirect_url: "/login?message=email_verified" };
    } catch (error) {
      console.error("Email verification error:", error);
      return reply.code(500).send({ error: "Email verification failed" });
    }
  });
};
