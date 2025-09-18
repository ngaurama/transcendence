const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

module.exports = function setupPasswordRoute(fastify, { dbService, emailService, secrets, authenticateToken }) {
  fastify.post("/forgot-password", async (request, reply) => {
      try {
        const { email } = request.body;

        if (!email) {
          return reply.code(400).send({ error: "Email required" });
        }

        const user = await dbService.db.get(
          "SELECT id, username, email, oauth_provider FROM users WHERE email = ? AND is_active = 1",
          [email]
        );

        if (!user) {
          return {
            success: true,
            message: "If an account exists, a reset link has been sent",
          };
        }

        if (user.oauth_provider && user.oauth_provider !== 'local') {
          return reply.code(400).send({ 
            error: `Password reset is not available for ${user.oauth_provider} accounts. Please use ${user.oauth_provider} to manage your account.` 
          });
        }

        const existingToken = await dbService.db.get(
          `
          SELECT id FROM password_reset_tokens 
          WHERE user_id = ? AND expires_at > datetime('now') AND used_at IS NULL
          `,
          [user.id]
        );

        if (existingToken) {
          return reply.code(429).send({ 
            error: "A password reset has already been requested. Please check your email or wait before requesting another." 
          });
        }

        const reset_token = jwt.sign(
          { user_id: user.id, action: "password_reset" },
          secrets.auth.jwt.secret,
          { expiresIn: "1h" }
        );

        await dbService.db.run(
          `
          INSERT INTO password_reset_tokens (
            user_id, token, expires_at, created_at
          ) VALUES (?, ?, datetime('now', '+1 hour'), datetime('now'))
          `,
          [user.id, reset_token]
        );

        const reset_url = `${process.env.FRONTEND_URL_LAN}/reset-password?token=${reset_token}`;
        const emailResult = await emailService.sendEmail(
          email,
          "Password Reset Request",
          `
            <h2>Password Reset for ft_transcendence</h2>
            <p>Hi ${user.username},</p>
            <p>You requested a password reset. Click the link below to set a new password:</p>
            <a href="${reset_url}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
            <p>This link will expire in 1 hour.</p>
            <p>If you did not request this password reset, please ignore this email or contact support if you have concerns.</p>
          `
        );

        return { 
          success: true, 
          message: "Password reset instructions have been sent to your email",
          ...(emailResult.isFallback && emailResult.token && {
            reset_token: emailResult.token,
            smtp_fallback: true
          })
        };
      } catch (error) {
        console.error("Forgot password error:", error);
        return reply.code(500).send({ error: "Password reset request failed" });
      }
  });

  fastify.post("/validate-reset-token", async (request, reply) => {
      try {
        const { token } = request.body;

        if (!token) {
          return reply.code(400).send({ error: "Token required" });
        }

        let decoded;
        try {
          decoded = jwt.verify(token, secrets.auth.jwt.secret);
        } catch {
          return reply.code(401).send({ error: "Invalid or expired token" });
        }

        if (decoded.action !== "password_reset") {
          return reply.code(401).send({ error: "Invalid token type" });
        }

        const resetToken = await dbService.db.get(
          `
          SELECT * FROM password_reset_tokens
          WHERE token = ? AND user_id = ? AND expires_at > datetime('now') AND used_at IS NULL
          `,
          [token, decoded.user_id]
        );

        if (!resetToken) {
          return reply.code(401).send({ error: "Invalid or used token" });
        }

        return { success: true, valid: true };
      } catch (error) {
        console.error("Reset token validation error:", error);
        return reply.code(500).send({ error: "Token validation failed" });
      }
  });

  fastify.post("/reset-password", async (request, reply) => {
      try {
        const { token, new_password } = request.body;

        if (!token || !new_password) {
          return reply.code(400).send({ error: "Token and new password required" });
        }

        let decoded;
        try {
          decoded = jwt.verify(token, secrets.auth.jwt.secret);
        } catch {
          return reply.code(401).send({ error: "Invalid or expired token" });
        }

        if (decoded.action !== "password_reset") {
          return reply.code(401).send({ error: "Invalid token type" });
        }

        const resetToken = await dbService.db.get(
          `
          SELECT * FROM password_reset_tokens
          WHERE token = ? AND user_id = ? AND expires_at > datetime('now') AND used_at IS NULL
        `,
          [token, decoded.user_id]
        );

        if (!resetToken) {
          return reply.code(401).send({ error: "Invalid or used token" });
        }

        const saltRounds = parseInt(secrets.auth.bcrypt.rounds, 10);
        const password_hash = await bcrypt.hash(new_password, saltRounds);

        await dbService.db.run(
          `
          UPDATE users 
          SET password_hash = ?, 
              totp_enabled = 0,
              totp_secret = NULL,
              updated_at = datetime('now')
          WHERE id = ?
        `,
          [password_hash, decoded.user_id]
        );

        await dbService.db.run(
          `
          UPDATE password_reset_tokens
          SET used_at = datetime('now')
          WHERE id = ?
        `,
          [resetToken.id]
        );

        await dbService.db.run(
          `
          DELETE FROM user_sessions WHERE user_id = ?
        `,
          [decoded.user_id]
        );

        return { success: true, message: "Password updated successfully" };
      } catch (error) {
        console.error("Password reset error:", error);
        return reply.code(500).send({ error: "Password reset failed" });
      }
  });

  fastify.post("/change-password", { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const { current_password, new_password } = request.body;
      const user_id = request.user.user_id;

      if (!current_password || !new_password) {
        return reply.code(400).send({ error: "Current and new password required" });
      }

      if (current_password === new_password) {
        return reply.code(400).send({ error: "New Password cannot be same as old password." });
      }

      const user = await dbService.db.get(
        "SELECT password_hash FROM users WHERE id = ?",
        [user_id]
      );

      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      const validPassword = await bcrypt.compare(current_password, user.password_hash);

      if (!validPassword) {
        return reply.code(401).send({ error: "Current password is incorrect" });
      }

      const saltRounds = parseInt(secrets.auth.bcrypt.rounds, 10);
      const new_password_hash = await bcrypt.hash(new_password, saltRounds);

      await dbService.db.run(
        `
        UPDATE users 
        SET password_hash = ?, updated_at = datetime('now')
        WHERE id = ?
        `,
        [new_password_hash, user_id]
      );

      await dbService.db.run(
        `
        DELETE FROM user_sessions WHERE user_id = ?
        `,
        [user_id]
      );

      return { success: true, message: "Password changed successfully" };
    } catch (error) {
      console.error("Change password error:", error);
      return reply.code(500).send({ error: "Password change failed" });
    }
  });
};