module.exports = {
  auth: process.env.AUTH_SERVICE_URL,
  chat: process.env.CHAT_SERVICE_URL,
  pong: process.env.PONG_SERVICE_URL,

  serviceConfigs: {
    auth: {
      prefix: '/auth',
      rewritePrefix: '/',
      websocket: false
    },
    // chat: {
    //   prefix: '/chat',
    //   rewritePrefix: '/',
    //   websocket: true,
    //   requiresAuth: true
    // },
    pong: {
      prefix: '/pong',
      rewritePrefix: '/',
      websocket: true,
      requiresAuth: true
    },
  }
};
