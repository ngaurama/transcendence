const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt"); 

module.exports = function setupRegisterRoute(fastify, { dbService, emailService, secrets, authenticateToken }) {
  fastify.post("/register", async (request, reply) => {
    try {
      const { username, email, password, display_name, accept_gdpr } = request.body;

      if (!accept_gdpr) {
        return reply.code(403).send({ error: "You must accept GDPR terms to register." });
      }

      if (!username || !email || !password) {
        return reply.code(400).send({ error: "Missing required fields" });
      }

      if (username.length < 3 || display_name.length < 2) {
        return reply.code(400).send({
          error: "Username must be at least 3 chars, display name at least 2",
        });
      }

      if (!email.includes("@")) {
        return reply.code(400).send({ error: "Invalid email format" });
      }

      const existingUser = await dbService.db.get(
        "SELECT id FROM users WHERE username = ? OR email = ?",
        [username, email]
      );

      if (existingUser) {
        return reply.code(409).send({ error: "User already exists" });
      }

      const saltRounds = parseInt(secrets.auth.bcrypt.rounds, 10);
      const password_hash = await bcrypt.hash(password, saltRounds);

      const result = await dbService.db.run(
        `
        INSERT INTO users (
          username, email, password_hash, display_name,
          avatar_url, oauth_provider, is_active, is_verified,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `,
        [
          username,
          email,
          password_hash,
          display_name || username,
          "/avatars/default.png",
          "local",
          true,
          false,
        ]
      );

      const user_id = result.lastID;

      const verification_token = jwt.sign(
        { user_id, action: "verify_email" },
        secrets.auth.jwt.secret,
        { expiresIn: "24h" }
      );

      await dbService.db.run(
        `
        INSERT INTO email_verification_tokens (
          user_id, token, expires_at, created_at
        ) VALUES (?, ?, datetime('now', '+24 hours'), datetime('now'))
      `,
        [user_id, verification_token]
      );

      const verification_url = `${process.env.FRONTEND_URL}/verify-email?token=${verification_token}`;
      await emailService.sendEmail(
        email,
        "Verify Your Email Address",
        `
          <h2>Welcome to ft_transcendence!</h2>
          <p>Please verify your email by clicking the link below:</p>
          <a href="${verification_url}">Verify Email</a>
          <p>This link will expire in 24 hours.</p>
        `
      );

      const access_token = jwt.sign(
        { user_id, username, email },
        secrets.auth.jwt.secret,
        { expiresIn: "15m" }
      );

      const refresh_token = jwt.sign(
        { user_id },
        secrets.auth.jwt.secret,
        { expiresIn: "7d" }
      );

      await dbService.db.run(
        `
        INSERT INTO user_sessions (
          user_id, refresh_token, expires_at, ip_address, user_agent, created_at, last_used_at
        ) VALUES (?, ?, datetime('now', '+7 days'), ?, ?, datetime('now'), datetime('now'))
      `,
        [
          user_id,
          await bcrypt.hash(refresh_token, saltRounds),
          request.ip,
          request.headers["user-agent"],
        ]
      );

      return {
        success: true,
        user: {
          id: user_id,
          username,
          email,
          display_name: display_name || username,
          avatar_url: "/avatars/default.png",
          is_verified: false,
        },
        access_token,
        refresh_token,
        message: "Registration successful. Please verify your email.",
      };
    } catch (error) {
      console.error("Registration error:", error);
      return reply.code(500).send({ error: "Registration failed" });
    }
  });
};
