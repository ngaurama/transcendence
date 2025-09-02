function isProtectedPongRoute(url) {
  const protectedRoutes = [
    '/game',
    '/wss/'
  ];

  return protectedRoutes.some(route => url.includes(route));
}

function isProtectedSocialRoute(url) {
  const protectedRoutes = [
    '/game',
    '/stats',
    '/friends',
    '/wss/'
  ];

  return protectedRoutes.some(route => url.includes(route));
}


module.exports = {
  isProtectedPongRoute,
  isProtectedSocialRoute,
};
