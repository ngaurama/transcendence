//commented out cause a lot changed since then

// async function docsRoutes(fastify, options) {
//   fastify.get('/api/docs', async (request, reply) => {
//     return {
//       name: 'ft_transcendence API Gateway',
//       version: '1.0.0',
//       services: {
//         auth: {
//           prefix: '/api/auth',
//           endpoints: [
//             'POST /register',
//             'POST /login',
//             'POST /logout',
//             'POST /verify-2fa',
//             'POST /setup-2fa',
//             'POST /enable-2fa',
//             'POST /validate-token',
//             'POST /upload-avatar'
//           ]
//         },
//         // chat: {
//         //   prefix: '/api/chat',
//         //   endpoints: [
//         //     'GET /messages',
//         //     'POST /send',
//         //     'POST /block-user',
//         //     'WebSocket /wss/chat'
//         //   ]
//         // },
//         game: {
//           prefix: '/api/game',
//           endpoints: [
//             'GET /public-games/:gameType',
//             'POST /join',
//             'POST /tournament/create',
//             'GET /tournament/:id',
//             'POST /matchmaking/join',
//             'WebSocket /wss'
//           ]
//         },
//         pong: {
//           prefix: '/api/pong',
//           endpoints: [
//             'POST /game/create',
//             'POST /move',
//             'GET /game/:id',
//             'WebSocket /wss/pong'
//           ]
//         },
//       }
//     };
//   });
// }

// module.exports = docsRoutes;
