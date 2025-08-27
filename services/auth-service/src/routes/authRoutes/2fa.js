const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

module.exports = function setup2faRoute(fastify, { dbService, emailService, secrets, authenticateToken }) {
  fastify.post("/verify-2fa", async (request, reply) => {
    try {
      const { temp_token, code } = request.body;

      if (!temp_token || !code) {
        return reply.code(400).send({ error: "Missing token or code" });
      }

      let decoded;
      try {
        decoded = jwt.verify(temp_token, secrets.auth.jwt.secret);
      } catch {
        return reply.code(401).send({ error: "Invalid or expired token" });
      }

      if (decoded.step !== "2fa_required") {
        return reply.code(401).send({ error: "Invalid token type" });
      }

      const user = await dbService.db.get(
        `
        SELECT id, username, email, display_name, totp_secret, avatar_url, is_verified
        FROM users WHERE id = ?
      `,
        [decoded.user_id]
      );

      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      const verified = speakeasy.totp.verify({
        secret: user.totp_secret,
        encoding: "base32",
        token: code,
        window: 2,
      });

      if (!verified) {
        return reply.code(401).send({ error: "Invalid 2FA code" });
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

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          is_verified: user.is_verified,
        },
        access_token,
        refresh_token,
      };
    } catch (error) {
      console.error("2FA verification error:", error);
      return reply.code(500).send({ error: "2FA verification failed" });
    }
  });

  fastify.post("/setup-2fa", { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const user_id = request.user.user_id;

      const user = await dbService.db.get(
        "SELECT oauth_provider FROM users WHERE id = ?",
        [user_id]
      );

      if (user.oauth_provider && user.oauth_provider !== 'local') {
        return reply.code(400).send({ 
          error: "2FA is not available for OAuth users" 
        });
      }

      const secret = speakeasy.generateSecret({
        name: `ft_transcendence (${request.user.username})`,
        issuer: "ft_transcendence",
      });
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      await dbService.db.run(
        `
        UPDATE users 
        SET totp_secret = ?, updated_at = datetime('now')
        WHERE id = ?
      `,
        [secret.base32, user_id]
      );

      return {
        success: true,
        secret: secret.base32,
        qr_code: qrCodeUrl,
        manual_entry_key: secret.base32,
      };
    } catch (error) {
      console.error("2FA setup error:", error);
      return reply.code(500).send({ error: "2FA setup failed" });
    }
  });

  fastify.post("/enable-2fa", { preHandler: authenticateToken }, async (request, reply) => {
      try {
        const { code } = request.body;
        const user_id = request.user.user_id;

        if (!code) {
          return reply.code(400).send({ error: "Verification code required" });
        }

        const user = await dbService.db.get(
          `
          SELECT totp_secret FROM users WHERE id = ?
        `,
          [user_id]
        );

        if (!user.totp_secret) {
          return reply.code(400).send({ error: "No 2FA secret found" });
        }

        const verified = speakeasy.totp.verify({
          secret: user.totp_secret,
          encoding: "base32",
          token: code,
          window: 2,
        });

        if (!verified) {
          return reply.code(401).send({ error: "Invalid verification code" });
        }

        await dbService.db.run(
          `
          UPDATE users 
          SET totp_enabled = 1, 
              updated_at = datetime('now')
          WHERE id = ?
        `,
          [user_id]
        );

        return { success: true, message: "2FA enabled successfully" };
      } catch (error) {
        console.error("2FA enable error:", error);
        return reply.code(500).send({ error: "Failed to enable 2FA" });
      }
  });
};
