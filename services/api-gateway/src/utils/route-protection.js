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
  isProtectedPongRoute,
};
