const axios = require("axios");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

module.exports = function setupGoogleOauthRoute(fastify, { dbService, emailService, secrets, authenticateToken }) {

    async function permanentAccountCleanup(userId) {
        await this.dbService.db.run(`DELETE FROM users WHERE id = ?`, [userId]);
        await this.dbService.db.run(`DELETE FROM user_sessions WHERE user_id = ?`, [userId]);
        await this.dbService.db.run(`DELETE FROM user_game_stats WHERE user_id = ?`, [userId]);
        await this.dbService.db.run(`DELETE FROM friendships WHERE requester_id = ? OR addressee_id = ?`, [userId, userId]);
        await this.dbService.db.run(`DELETE FROM tournament_participants WHERE user_id = ?`, [userId]);
    }

    fastify.get("/oauth/google", async (request, reply) => {
        const { client_id, redirect_uri } = secrets.external.google;
        const scope = "profile email";
        const auth_url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${client_id}&redirect_uri=${encodeURIComponent(
            redirect_uri
        )}&response_type=code&scope=${encodeURIComponent(scope)}`;
        reply.redirect(auth_url);
    });

    fastify.get("/oauth/google/callback", async (request, reply) => {
        try {
            const { code } = request.query;
            if (!code) {
                return reply.code(400).send({ error: "Authorization code missing" });
            }

            const { client_id, client_secret, redirect_uri } = secrets.external.google;
            const tokenResponse = await axios.post(
                "https://oauth2.googleapis.com/token",
                {
                    code,
                    client_id,
                    client_secret,
                    redirect_uri,
                    grant_type: "authorization_code",
                }
            );

            const { access_token: google_access_token } = tokenResponse.data;
            const userResponse = await axios.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                {
                    headers: { Authorization: `Bearer ${google_access_token}` },
                }
            );

            const { id: google_id, email, name } = userResponse.data;
            let user = await dbService.db.get(
                `
                    SELECT id, username, email, display_name, avatar_url, is_active, 
                    is_verified, totp_enabled, totp_secret, oauth_provider
                    FROM users WHERE google_id = ? OR email = ?
                `,
                [google_id, email]
            );

            if (user && user.deletion_requested_at) {
                const deletionDate = new Date(user.deletion_requested_at);
                const gracePeriodEnd = new Date(deletionDate.getTime() + (30 * 24 * 60 * 60 * 1000));
                
                if (new Date() > gracePeriodEnd) {
                    await permanentAccountCleanup(user.id);
                    user = null;
                }
            }

            if (!user) {
                const username = await dbService.generateUniqueUsername(email);
                const result = await dbService.db.run(
                    `
                        INSERT INTO users (
                            username, email, display_name, avatar_url, google_id, oauth_provider,
                            is_active, is_verified, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                        `,
                    [
                        username,
                        email,
                        name || username,
                        "/avatars/default.png",
                        google_id,
                        "google",
                        true,
                        true,
                    ]
                );
                user = {
                    id: result.lastID,
                    username,
                    email,
                    display_name: name || username,
                    avatar_url: "/avatars/default.png",
                    is_active: true,
                    is_verified: true,
                };
            }

            if (!user.is_active) {
                return reply.code(403).send({ error: "Account is not active" });
            }

            if (user.oauth_provider && user.oauth_provider !== 'google') {
                return reply.redirect(
                    `${process.env.FRONTEND_URL}/auth/callback?error=account_mismatch&provider=${user.oauth_provider}`
                );
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
                `
        UPDATE users SET last_login_at = datetime('now') WHERE id = ?
      `,
                [user.id]
            );

            reply.redirect(
                `${process.env.FRONTEND_URL}/auth/callback?access_token=${access_token}&refresh_token=${refresh_token}`
            );
        } catch (error) {
            console.error("Google OAuth error:", error);
            return reply.redirect(`${process.env.FRONTEND_URL}/auth/callback?error=oauth_failed`);
        }
    });
};
