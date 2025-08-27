const fs = require("fs");
const path = require("path");

function setupOAuthRoutes(fastify, { dbService, emailService, secrets, authenticateToken }) {
  const routeFiles = fs.readdirSync(__dirname).filter(file => file !== "index.js");

  for (const file of routeFiles) {
    const setupRoute = require(path.join(__dirname, file));
    setupRoute(fastify, { dbService, emailService, secrets, authenticateToken });
  }
}

module.exports = { setupOAuthRoutes };
