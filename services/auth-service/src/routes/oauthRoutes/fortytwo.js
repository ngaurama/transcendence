const axios = require("axios");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const qs = require("querystring");
const NodeCache = require("node-cache");

const userCache = new NodeCache({ stdTTL: 600 });

module.exports = function setup42OauthRoute(fastify, { dbService, emailService, secrets, authenticateToken }) {

    async function permanentAccountCleanup(userId) {
        await dbService.db.run(`DELETE FROM users WHERE id = ?`, [userId]);
        await dbService.db.run(`DELETE FROM user_sessions WHERE user_id = ?`, [userId]);
        await dbService.db.run(`DELETE FROM user_game_stats WHERE user_id = ?`, [userId]);
        await dbService.db.run(`DELETE FROM friendships WHERE requester_id = ? OR addressee_id = ?`, [userId, userId]);
        await dbService.db.run(`DELETE FROM tournament_participants WHERE user_id = ?`, [userId]);
    }

    fastify.get("/oauth/fortytwo", async (request, reply) => {
        const { client_id, redirect_uri } = secrets.external.fortytwo;
        const scope = "public";
        const auth_url = `https://api.intra.42.fr/oauth/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(
            redirect_uri
        )}&response_type=code&scope=${encodeURIComponent(scope)}`;
        reply.redirect(auth_url);
    });

    fastify.get("/oauth/fortytwo/callback", async (request, reply) => {
        try {
            const { code } = request.query;
            if (!code) {
                return reply.code(400).send({ error: "Authorization code missing" });
            }

            const { client_id, client_secret, redirect_uri } = secrets.external.fortytwo;

            const tokenResponse = await axios.post(
                "https://api.intra.42.fr/oauth/token",
                {
                    grant_type: "authorization_code",
                    client_id,
                    client_secret,
                    code,
                    redirect_uri,
                }
            );

            const { access_token: fortytwo_access_token } = tokenResponse.data;
            
            const userResponse = await axios.get("https://api.intra.42.fr/v2/me", {
                headers: { Authorization: `Bearer ${fortytwo_access_token}` },
            });

            const { id: fortytwo_id, login, email, displayname, image_url } = userResponse.data;
            
            let user = await dbService.db.get(
                `
                SELECT id, username, email, display_name, avatar_url, is_active, 
                is_verified, totp_enabled, totp_secret, oauth_provider
                FROM users WHERE fortytwo_id = ? OR email = ?
                `,
                [fortytwo_id, email]
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
                        username, email, display_name, avatar_url, fortytwo_id, oauth_provider,
                        is_active, is_verified, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                    `,
                    [
                        username,
                        email,
                        displayname || login || username,
                        image_url || "/avatars/default.png",
                        fortytwo_id,
                        "fortytwo",
                        true,
                        true,
                    ]
                );
                user = {
                    id: result.lastID,
                    username,
                    email,
                    display_name: displayname || login || username,
                    avatar_url: image_url || "/avatars/default.png",
                    is_active: true,
                    is_verified: true,
                };
            }

            if (!user.is_active) {
                return reply.code(403).send({ error: "Account is not active" });
            }

            if (user.oauth_provider && user.oauth_provider !== 'fortytwo') {
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
                `UPDATE users SET last_login_at = datetime('now') WHERE id = ?`,
                [user.id]
            );

            reply.redirect(
                `${process.env.FRONTEND_URL}/auth/callback?access_token=${access_token}&refresh_token=${refresh_token}`
            );
        } catch (error) {
            console.error("42 OAuth error:", error.response?.data || error.message);
            return reply.redirect(`${process.env.FRONTEND_URL}/auth/callback?error=oauth_failed`);
        }
    });

    fastify.get("/oauth/fortytwo/user/:login", async (request, reply) => {
        try {
            const { login } = request.params;
            
            const cachedUser = userCache.get(login);
            if (cachedUser) {
            return cachedUser;
            }
            
            const { client_id, client_secret } = secrets.external.fortytwo;
            
            const tokenResponse = await axios.post(
            "https://api.intra.42.fr/oauth/token",
            {
                grant_type: "client_credentials",
                client_id,
                client_secret,
                scope: "public"
            }
            );
            
            const access_token = tokenResponse.data.access_token;
            
            const userResponse = await axios.get(
            `https://api.intra.42.fr/v2/users/${login}`,
            {
                headers: { Authorization: `Bearer ${access_token}` },
            }
            );
            
            userCache.set(login, userResponse.data);
            
            console.log("RESPONSE: ", userResponse.data);
            return userResponse.data;
            
        } catch (error) {
            console.error("42 API error:", error.response?.data || error.message);
            
            if (error.response?.status === 404) {
            return reply.code(404).send({ error: "User not found" });
            }
            
            if (error.response?.status === 429) {
            return reply.code(429).send({ error: "Rate limit exceeded" });
            }
            
            return reply.code(500).send({ error: "Internal server error" });
        }
    });
}
