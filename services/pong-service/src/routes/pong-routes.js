const { validateToken } = require('../utils/auth');

function setupRoutes(fastify, pongService) {
  fastify.get('/health', async (request, reply) => {
    return {
      status: 'healthy',
      service: 'pong-service',
      active_games: pongService.gameRooms.size
    };
  });

  fastify.post('/game/create', async (request, reply) => {
    try {
      const userId = request.headers['x-user-id'];
      const username = request.headers['x-username'];
      const {
        is_private = false,
        max_players = 2,
        power_ups_enabled = false,
        map_variant = 'classic',
        points_to_win = 5,
        opponent_alias = 'Player 2'
      } = request.body;

      if (!userId) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const gameType = await pongService.db.get('SELECT id FROM game_types WHERE name = ?', ['pong']);
      if (!gameType) {
        return reply.code(400).send({ error: 'Game type not found' });
      }

      const user = await pongService.db.get(
        'SELECT display_name FROM users WHERE id = ?',
        [userId]
      );
      const player1_name = user?.display_name || username || 'Player 1';

      const gameResult = await pongService.db.run(`
        INSERT INTO game_sessions (
          game_type_id, status, max_players, created_at
        ) VALUES (?, ?, ?, datetime('now'))
      `, [gameType.id, 'waiting', max_players]);

      const gameId = gameResult.lastID;

      await pongService.db.run(`
        INSERT INTO game_participants (
          game_session_id, user_id, player_number, joined_at
        ) VALUES (?, ?, ?, datetime('now'))
      `, [gameId, userId, 1]);

      const game = pongService.createGame(gameId, {
        max_players,
        power_ups_enabled,
        map_variant,
        is_private,
        points_to_win,
        opponent_alias,
        player1_name
      });

      if (is_private) {
        game.addPlayer(userId, 1);
        game.addPlayer(`${userId}_player2`, 2);
        game.start();
      }

      return {
        success: true,
        game_id: gameId,
        message: 'Pong game created successfully'
      };
    } catch (error) {
      console.error('Error creating game:', error);
      return reply.code(500).send({ error: 'Failed to create game' });
    }
  });

  fastify.get('/wss', { websocket: true }, (connection, request) => {
    let authenticated = false;
    let userId = null;
    let gameId = null;

    const authTimeout = setTimeout(() => {
      if (!authenticated) {
        connection.close(4001, 'Authentication timeout');
      }
    }, 5000);

    connection.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'auth' && data.token) {
          const user = await validateToken(data.token);
          if (user) {
            authenticated = true;
            userId = user.id;
            clearTimeout(authTimeout);
            gameId = request.query.game_id;

            if (!gameId) {
              connection.close(4000, 'Game ID required');
              return;
            }

            const gameRoom = pongService.gameRooms.get(parseInt(gameId));
            if (!gameRoom) {
              connection.close(4004, 'Game not found');
              return;
            }

            gameRoom.addConnection(userId, connection);
            connection.send(JSON.stringify({
              type: 'auth_success',
              user_id: userId,
              player_id: gameRoom.options.is_private ? 'both' : 'player1'
            }));
            console.log(`User ${userId} authenticated for game ${gameId} as ${gameRoom.options.is_private ? 'both players' : 'player1'}`);
          } else {
            connection.close(4002, 'Invalid token');
          }
        } else if (authenticated && data.type === 'paddle_move') {
          const gameRoom = pongService.gameRooms.get(parseInt(gameId));
          if (gameRoom) {
            gameRoom.handlePlayerInput(userId, data);
          }
        }
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
      }
    });

    connection.on('close', () => {
      clearTimeout(authTimeout);
      if (authenticated && gameId) {
        const gameRoom = pongService.gameRooms.get(parseInt(gameId));
        if (gameRoom) {
          gameRoom.removeConnection(userId);
        }
      }
    });
  });
}

module.exports = { setupRoutes };
