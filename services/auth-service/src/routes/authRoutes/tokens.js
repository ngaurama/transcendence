const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

module.exports = function setupTokensRoute(fastify, { dbService, emailService, secrets, authenticateToken }) {
  fastify.post("/refresh-token", async (request, reply) => {
      try {
        const { refresh_token } = request.body;

        if (!refresh_token) {
          return reply.code(400).send({ error: "Refresh token required" });
        }

        let decoded;
        try {
          decoded = jwt.verify(refresh_token, secrets.auth.jwt.secret);
        } catch (error) {
          return reply.code(401).send({ error: "Invalid refresh token" });
        }

        const session = await dbService.db.get(
          `
          SELECT * FROM user_sessions 
          WHERE user_id = ? AND expires_at > datetime('now')
          LIMIT 1
        `,
          [decoded.user_id]
        );

        if (
          !session ||
          !(await bcrypt.compare(refresh_token, session.refresh_token))
        ) {
          return reply.code(401).send({ error: "Invalid session" });
        }

        const user = await dbService.db.get(
          `
          SELECT id, username, email, display_name, avatar_url, is_verified
          FROM users WHERE id = ? AND is_active = 1
        `,
          [decoded.user_id]
        );

        if (!user) {
          return reply.code(404).send({ error: "User not found" });
        }

        const new_access_token = jwt.sign(
          { user_id: user.id, username: user.username, email: user.email },
          secrets.auth.jwt.secret,
          { expiresIn: "15m" }
        );

        const new_refresh_token = jwt.sign(
          { user_id: user.id },
          secrets.auth.jwt.secret,
          { expiresIn: "7d" }
        );

        const saltRounds = parseInt(secrets.auth.bcrypt.rounds, 10);
        await dbService.db.run(
          `
          UPDATE user_sessions SET
            refresh_token = ?,
            expires_at = datetime('now', '+7 days'),
            last_used_at = datetime('now')
          WHERE id = ?
        `,
          [await bcrypt.hash(new_refresh_token, saltRounds), session.id]
        );

        return {
          success: true,
          access_token: new_access_token,
          refresh_token: new_refresh_token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            is_verified: user.is_verified,
          },
        };
      } catch (error) {
        console.error("Token refresh error:", error);
        return reply.code(500).send({ error: "Token refresh failed" });
      }
  });

  fastify.post("/validate-token", async (request, reply) => {
      try {
        const { token } = request.body;

        if (!token) {
          return reply.code(400).send({ error: "Token required" });
        }

        let decoded;
        try {
          decoded = jwt.verify(token, secrets.auth.jwt.secret);
        } catch {
          return reply.code(401).send({ error: "Invalid token" });
        }

        const session = await dbService.db.get(
          `
          SELECT 1 FROM user_sessions 
          WHERE user_id = ? AND expires_at > datetime('now')
          LIMIT 1
        `,
          [decoded.user_id]
        );

        if (!session) {
          return reply.code(401).send({ error: "No active session" });
        }

        const user = await dbService.db.get(
          `
          SELECT id, username, email, display_name, avatar_url, oauth_provider, is_guest, created_at
          FROM users 
          WHERE id = ? AND is_active = 1
        `,
          [decoded.user_id]
        );

        if (!user) {
          return reply.code(401).send({ error: "User not active" });
        }

        return {
          success: true,
          valid: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            is_verified: user.is_verified,
            oauth_provider: user.oauth_provider,
            is_guest: user.is_guest,
            created_at: user.created_at
          },
        };
      } catch (error) {
        console.error("Token validation error:", error);
        return reply.code(500).send({ error: "Token validation failed" });
      }
  });
};
