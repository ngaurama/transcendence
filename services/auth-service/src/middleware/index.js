const jwt = require("jsonwebtoken");

function createAuthenticateToken(secrets, dbService) {
  return async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      const token = authHeader && authHeader.split(" ")[1];

      if (!token) {
        return reply.code(401).send({ error: "Access token required" });
      }

      const decoded = jwt.verify(token, secrets.auth.jwt.secret);
      request.user = decoded;

      const user = await dbService.db.get(
        `SELECT 1 FROM users WHERE id = ? AND is_active = 1`,
        [decoded.user_id]
      );

      if (!user) {
        return reply.code(401).send({ error: "User not active" });
      }
    } catch (error) {
      return reply.code(403).send({ error: "Invalid token" });
    }
  };
}

module.exports = { createAuthenticateToken };
