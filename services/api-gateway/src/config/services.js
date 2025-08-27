module.exports = {
  auth: process.env.AUTH_SERVICE_URL,
  game: process.env.GAME_SERVICE_URL,
  chat: process.env.CHAT_SERVICE_URL,
  pong: process.env.PONG_SERVICE_URL,

  serviceConfigs: {
    auth: {
      prefix: '/auth',
      rewritePrefix: '/',
      websocket: false
    },
    game: {
      prefix: '/game',
      rewritePrefix: '/',
      websocket: true,
      requiresAuth: true
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
