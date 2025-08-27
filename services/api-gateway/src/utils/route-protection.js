function isProtectedGameRoute(url) {
  const protectedRoutes = [
    '/tournament/create',
    '/tournament/join',
    '/matchmaking/join',
    '/join',
    '/stats',
    '/history',
    '/wss/'
  ];

  return protectedRoutes.some(route => url.includes(route));
}

function isProtectedPongRoute(url) {
  const protectedRoutes = [
    '/game/create',
    '/move',
    '/stats',
    '/history',
    '/wss/'
  ];

  return protectedRoutes.some(route => url.includes(route));
}


module.exports = {
  isProtectedGameRoute,
  isProtectedPongRoute,
};
