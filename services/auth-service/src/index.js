const Fastify = require("fastify");
const path = require("path");
const fsSync = require("fs");
const { AuthService } = require("./config");

const keyPath = path.resolve('/app/certs/server.key');
const certPath = path.resolve('/app/certs/server.crt');

const fastify = Fastify({
  logger: true,
  https: {
    key: fsSync.readFileSync(keyPath, 'utf8'),
    cert: fsSync.readFileSync(certPath, 'utf8')
  }
});

new AuthService(fastify);
