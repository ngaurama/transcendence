const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

module.exports = function setupLoginRoute(fastify, { dbService, emailService, secrets, authenticateToken }) {
  fastify.post("/login", async (request, reply) => {
    try {
      const { username, password } = request.body;

      if (!username || !password) {
        return reply.code(400).send({ error: "Missing username or password" });
      }

      const user = await dbService.db.get(
        `
        SELECT id, username, email, password_hash, display_name, 
              totp_enabled, totp_secret, is_active, avatar_url, 
              is_verified, oauth_provider
        FROM users 
        WHERE username = ? OR email = ?
      `,
        [username, username]
      );

      if (!user || !user.is_active) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }

      if (user.oauth_provider !== 'local' && user.oauth_provider !== null) {
        return reply.code(403).send({ 
          error: `This account was created via ${user.oauth_provider}. Please use ${user.oauth_provider} login.` 
        });
      }

      if (!user.is_verified) {
        return reply.code(403).send({ error: "Email not verified" });
      }

      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }

      if (user.totp_enabled) {
        const temp_token = jwt.sign(
          { user_id: user.id, step: "2fa_required" },
          secrets.auth.jwt.secret,
          { expiresIn: "5m" }
        );

        return {
          requires_2fa: true,
          temp_token,
        };
      }

      const access_token = jwt.sign(
        { user_id: user.id, username: user.username, email: user.email },
        secrets.auth.jwt.secret,
        { expiresIn: "15m" }
      );

      const refresh_token = jwt.sign(
        { user_id: user.id },
        secrets.auth.jwt.secret,
        { expiresIn: "7d" }
      );

      const saltRounds = parseInt(secrets.auth.bcrypt.rounds, 10);
      await dbService.db.run(
        `
        INSERT INTO user_sessions (
          user_id, refresh_token, expires_at, ip_address, user_agent, created_at, last_used_at
        ) VALUES (?, ?, datetime('now', '+7 days'), ?, ?, datetime('now'), datetime('now'))
      `,
        [
          user.id,
          await bcrypt.hash(refresh_token, saltRounds),
          request.ip,
          request.headers["user-agent"],
        ]
      );

      await dbService.db.run(
        `UPDATE users SET last_login_at = datetime('now') WHERE id = ?`,
        [user.id]
      );

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
        },
        access_token,
        refresh_token,
      };
    } catch (error) {
      console.error("Login error:", error);
      return reply.code(500).send({ error: "Login failed" });
    }
  });

  fastify.post("/logout", { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const { all_devices = false } = request.body;
      const user_id = request.user.user_id;

      if (all_devices) {
        await dbService.db.run(
          `
          DELETE FROM user_sessions WHERE user_id = ?
        `,
          [user_id]
        );
      } else {
        if (!request.body.refresh_token) {
          return reply.code(400).send({
            error: "Refresh token required for single-device logout",
          });
        }

        const session = await dbService.db.get(
          `
          SELECT * FROM user_sessions 
          WHERE user_id = ? AND expires_at > datetime('now')
        `,
          [user_id]
        );

        if (
          session &&
          (await bcrypt.compare(request.body.refresh_token, session.refresh_token))
        ) {
          await dbService.db.run(
            `
            DELETE FROM user_sessions WHERE id = ?
          `,
            [session.id]
          );
        } else {
          return reply.code(401).send({ error: "Invalid refresh token" });
        }
      }

      return { success: true, message: "Logged out successfully" };
    } catch (error) {
      console.error("Logout error:", error);
      return reply.code(500).send({ error: "Logout failed" });
    }
  });
};
