const path = require("path");
const fs = require("fs").promises;
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

function setupUserRoutes(fastify, { dbService, secrets, authenticateToken }) {
  fastify.get("/user", { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const user = await dbService.db.get(
        `
        SELECT id, username, email, display_name, avatar_url, 
              is_verified, oauth_provider, totp_enabled
        FROM users WHERE id = ?
        `,
        [request.user.user_id]
      );

      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      return { success: true, user };
    } catch (error) {
      console.error("User details error:", error);
      return reply.code(500).send({ error: "Failed to fetch user details" });
    }
  });

  fastify.post("/upload-avatar", { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const data = await request.file();
      if (!data || !['image/png', 'image/jpeg'].includes(data.mimetype)) {
        return reply.code(400).send({ error: 'Invalid image format' });
      }

      const filename = `${request.user.user_id}_${Date.now()}.${data.mimetype.split('/')[1]}`;
      const filePath = path.join(__dirname, '../../../public/avatars', filename);

      await fs.writeFile(filePath, await data.toBuffer());

      await dbService.db.run(
        'UPDATE users SET avatar_url = ? WHERE id = ?',
        [`/avatars/${filename}`, request.user.user_id]
      );

      return { success: true, avatar_url: `/avatars/${filename}` };
    } catch (error) {
      console.error('Avatar upload error:', error);
      return reply.code(500).send({ error: 'Avatar upload failed' });
    }
  });

  fastify.post('/guest-login', async (request, reply) => {
    try {
      const { alias } = request.body;
      if (!alias) return reply.code(400).send({ error: 'Alias required' });

      const result = await dbService.db.run(`
        INSERT INTO users (
            username, email, display_name, avatar_url,
            is_active, is_verified, is_guest, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [null, null, alias, "/avatars/default.png", true, true, true]);

      const userId = result.lastID;

      const guestIdentifier = `guest_${userId}_${Date.now()}`;

      const access_token = jwt.sign(
        { user_id: userId, guest_identifier: guestIdentifier, is_guest: true },
        secrets.auth.jwt.secret,
        { expiresIn: "1h" }
      );

      const refresh_token = jwt.sign(
        { user_id: userId, guest_identifier: guestIdentifier },
        secrets.auth.jwt.secret,
        { expiresIn: "7d" }
      );

      const saltRounds = parseInt(secrets.auth.bcrypt.rounds, 10);
      await dbService.db.run(`
        INSERT INTO user_sessions (
            user_id, refresh_token, expires_at, ip_address, user_agent, created_at, last_used_at
        ) VALUES (?, ?, datetime('now', '+7 days'), ?, ?, datetime('now'), datetime('now'))
        `, [
        userId,
        await bcrypt.hash(refresh_token, saltRounds),
        request.ip,
        request.headers["user-agent"],
      ]);

      return {
      success: true,
      user: {
          id: userId,
          display_name: alias,
          avatar_url: "/avatars/default.png",
          is_guest: true,
          is_verified: true,
      },
      access_token,
      refresh_token,
      };
    } catch (error) {
      console.error("Guest login error:", error);
      return reply.code(500).send({ error: "Guest login failed" });
    }
  });

  fastify.post('/user/update', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { username, display_name } = request.body;

    if (username) {
      const existing = await dbService.db.get('SELECT id FROM users WHERE username = ? AND id != ?', [username, user.id]);
      if (existing) {
        return reply.code(400).send({ error: 'Username taken' });
      }
      await dbService.db.run('UPDATE users SET username = ? WHERE id = ?', [username, user.id]);
    }

    if (display_name) {
      await dbService.db.run('UPDATE users SET display_name = ? WHERE id = ?', [display_name, user.id]);
    }

    return { success: true };
  });
}

module.exports = { 
  setupUserRoutes
};
