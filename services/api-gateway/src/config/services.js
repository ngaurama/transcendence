module.exports = {
  auth: process.env.AUTH_SERVICE_URL,
  social: process.env.SOCIAL_SERVICE_URL,
  pong: process.env.PONG_SERVICE_URL,

  serviceConfigs: {
    auth: {
      prefix: '/auth',
      rewritePrefix: '/',
      websocket: false
    },
    social: {
      prefix: '/social',
      rewritePrefix: '/',
      websocket: true,
      requiresAuth: true
    },
    pong: {
      prefix: '/pong',
      rewritePrefix: '/',
      websocket: true,
      requiresAuth: true
    },
  }
};
