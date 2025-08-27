const fs = require('fs');
const path = require('path');

const ssl = {
  keyPath: path.resolve('/app/certs/server.key'),
  certPath: path.resolve('/app/certs/server.crt')
};

module.exports = {
  port: process.env.API_PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  ssl: {
    key: fs.readFileSync(ssl.keyPath, 'utf8'),
    cert: fs.readFileSync(ssl.certPath, 'utf8')
  },
  keyPath: ssl.keyPath,
  certPath: ssl.certPath,
  services: require('./services')
};
