const axios = require("axios");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

module.exports = function setupGithubOauthRoute(fastify, { dbService, emailService, secrets, authenticateToken }) {
    fastify.get("/oauth/github", async (request, reply) => {
        const { client_id, redirect_uri } = secrets.external.github;
        const scope = "user:email";
        const auth_url = `https://github.com/login/oauth/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(
            redirect_uri
        )}&scope=${encodeURIComponent(scope)}`;
        reply.redirect(auth_url);
    });

    fastify.get("/oauth/github/callback", async (request, reply) => {
        try {
            const { code } = request.query;
            if (!code) {
                return reply.code(400).send({ error: "Authorization code missing" });
            }

            const { client_id, client_secret, redirect_uri } = secrets.external.github;

            const tokenResponse = await axios.post(
                "https://github.com/login/oauth/access_token",
                {
                    client_id,
                    client_secret,
                    code,
                    redirect_uri,
                },
                {
                    headers: { Accept: "application/json" },
                }
            );

            const { access_token: github_access_token } = tokenResponse.data;
            const userResponse = await axios.get("https://api.github.com/user", {
                headers: { Authorization: `Bearer ${github_access_token}` },
            });

            const emailResponse = await axios.get(
                "https://api.github.com/user/emails",
                {
                    headers: { Authorization: `Bearer ${github_access_token}` },
                }
            );

            const primaryEmail = emailResponse.data.find(
                (e) => e.primary && e.verified
            )?.email;
            if (!primaryEmail) {
                return reply.code(400).send({ error: "No verified primary email found" });
            }

            const { id: github_id, login, name } = userResponse.data;
            let user = await dbService.db.get(
                `
        SELECT id, username, email, display_name, avatar_url, is_active, 
        is_verified, totp_enabled, totp_secret, oauth_provider
        FROM users WHERE github_id = ? OR email = ?
      `,
                [github_id, primaryEmail]
            );

            if (!user) {
                const username = await dbService.generateUniqueUsername(primaryEmail);
                const result = await dbService.db.run(
                    `
          INSERT INTO users (
            username, email, display_name, avatar_url, github_id, oauth_provider,
            is_active, is_verified, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `,
                    [
                        username,
                        primaryEmail,
                        name || login || username,
                        "/avatars/default.png",
                        github_id,
                        "github",
                        true,
                        true,
                    ]
                );
                user = {
                    id: result.lastID,
                    username,
                    email: primaryEmail,
                    display_name: name || login || username,
                    avatar_url: "/avatars/default.png",
                    is_active: true,
                    is_verified: true,
                };
            }

            if (!user.is_active) {
                return reply.code(403).send({ error: "Account is not active" });
            }

            if (user.oauth_provider && user.oauth_provider !== 'github') {
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
            console.error("GitHub OAuth error:", error);
            return reply.redirect(`${process.env.FRONTEND_URL}/auth/callback?error=oauth_failed`);
        }
    });
}