// routes/pong-routes.js
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
    console.log('Request body received:', JSON.stringify(request.body, null, 2));
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const {
      gameMode = 'local',
      gameType = '2player',
      player1_name,
      player2_name,
      players,
      is_rematch = true,
      powerups_enabled = false,
      points_to_win = 5,
      board_variant = 'classic',
      opponent_id,
    } = request.body;

    try {
      const gameSettings = {
        gameMode,
        powerups_enabled,
        points_to_win,
        board_variant
      };

      if (gameMode === 'online') {
        userPlayerDetails = players[0].id === user.id ? players[0] : players[1];
        opponentPlayerDetails = players[0].id === user.id ? players[1] : players[0];
      }

      const gameResult = await pongService.db.run(`
        INSERT INTO game_sessions (status, game_mode, game_settings, created_at) 
        VALUES ('waiting', ?, ?, CURRENT_TIMESTAMP)
      `, [gameMode, JSON.stringify(gameSettings)]);

      const gameId = gameResult.lastID;

      if (gameMode === 'local') {
        await pongService.db.run(`
          INSERT INTO game_participants (game_session_id, user_id, player_number) 
          VALUES (?, ?, 1)
        `, [gameId, user.id]);
      } else {
        await pongService.db.run(`
          INSERT INTO game_participants (game_session_id, user_id, player_number) 
          VALUES (?, ?, ?)
        `, [gameId, user.id, userPlayerDetails.player_number]);
      }

      const options = {
        gameMode,
        gameType,
        powerups_enabled,
        points_to_win,
        board_variant,
        player1_name,
        player2_name
      };

      pongService.createGame(gameId, options);

      if (gameMode === 'local') {
        const guestResult = await pongService.db.run(`
          INSERT INTO users (display_name, is_guest, created_at) 
          VALUES (?, TRUE, CURRENT_TIMESTAMP)
        `, [player2_name || 'Opponent']);

        const guestId = guestResult.lastID;

        await pongService.db.run(`
          INSERT INTO game_participants (game_session_id, user_id, player_number) 
          VALUES (?, ?, 2)
        `, [gameId, guestId]);
      } else if (opponent_id) {
        const opponent = await pongService.db.get('SELECT id FROM users WHERE id = ?', [opponent_id]);
        if (!opponent) {
          return reply.code(400).send({ error: 'Opponent not found' });
        }

        await pongService.db.run(`
          INSERT INTO game_participants (game_session_id, user_id, player_number) 
          VALUES (?, ?, ?)
        `, [gameId, opponent_id, opponentPlayerDetails.player_number]);

        await pongService.handleGameInvitation(opponent_id, {
          game_id: gameId,
          inviter_id: user.id,
          inviter_name: user.display_name,
          game_settings: gameSettings
        });
      }

      return { game_id: gameId };
    } catch (error) {
      console.error('Error creating game:', error);
      return reply.code(500).send({ error: 'Failed to create game' });
    }
  });

  fastify.get('/game/:gameId', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const gameId = parseInt(request.params.gameId);

    try {
      const game = await pongService.db.get(`
        SELECT 
          gs.id,
          gs.status,
          gs.created_at,
          gs.ended_at,
          gs.game_mode,
          gs.final_score_player1,
          gs.final_score_player2,
          gs.game_duration_ms,
          gs.game_settings,
          gs.tournament_id,
          gs.winner_id,
          u1.display_name as player1_name,
          u2.display_name as player2_name,
          gp1.user_id as player1_id,
          gp2.user_id as player2_id
        FROM game_sessions gs
        LEFT JOIN game_participants gp1 ON gp1.game_session_id = gs.id AND gp1.player_number = 1
        LEFT JOIN game_participants gp2 ON gp2.game_session_id = gs.id AND gp2.player_number = 2
        LEFT JOIN users u1 ON u1.id = gp1.user_id
        LEFT JOIN users u2 ON u2.id = gp2.user_id
        WHERE gs.id = ?
      `, [gameId]);

      if (!game) {
        return reply.code(404).send({ error: 'Game not found' });
      }

      if (game.game_mode === 'online' && game.player1_id !== user.id && game.player2_id !== user.id) {
        return reply.code(403).send({ error: 'Not authorized to view this game' });
      }

      return {
        id: game.id,
        status: game.status,
        created_at: game.created_at,
        ended_at: game.ended_at,
        duration: game.game_duration_ms,
        score: game.final_score_player1 !== null && game.final_score_player2 !== null 
          ? `${game.final_score_player1}-${game.final_score_player2}` 
          : null,
        settings: JSON.parse(game.game_settings),
        tournament_id: game.tournament_id,
        winner_id: game.winner_id,
        players: [
          {
            id: game.player1_id,
            name: game.player1_name,
            player_number: 1
          },
          {
            id: game.player2_id,
            name: game.player2_name,
            player_number: 2
          }
        ]
      };
    } catch (error) {
      console.error('Error fetching game info:', error);
      return reply.code(500).send({ error: 'Failed to fetch game information' });
    }
  });

  fastify.post('/game/invitation/accept/:gameId', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const gameId = parseInt(request.params.gameId);
    
    try {
      await pongService.acceptGameInvitation(user.id, gameId);
      return { success: true, game_id: gameId };
    } catch (error) {
      console.error('Error accepting invitation:', error);
      return reply.code(400).send({ error: error.message });
    }
  });

  fastify.post('/game/invitation/decline/:gameId', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const gameId = parseInt(request.params.gameId);
    
    try {
      await pongService.declineGameInvitation(user.id, gameId);
      return { success: true };
    } catch (error) {
      console.error('Error declining invitation:', error);
      return reply.code(400).send({ error: error.message });
    }
  });

  fastify.get('/game/invitations', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const invitations = pongService.pendingInvitations.get(user.id) || [];
    return invitations;
  });

  fastify.post('/game/join/:gameId', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const gameId = parseInt(request.params.gameId);

    const game = pongService.gameRooms.get(gameId);
    if (!game || game.options.gameMode === 'local') {
      return reply.code(400).send({ error: 'Invalid game' });
    }

    const existing = await pongService.db.get(`
      SELECT * FROM game_participants 
      WHERE game_session_id = ? AND user_id = ?
    `, [gameId, user.id]);

    if (existing) {
      return reply.code(400).send({ error: 'Already joined' });
    }

    await pongService.db.run(`
      INSERT INTO game_participants (game_session_id, user_id, player_number) 
      VALUES (?, ?, 2)
    `, [gameId, user.id]);

    return { success: true };
  });

  fastify.post('/matchmaking/join', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const existing = await pongService.db.get(`
      SELECT * FROM matchmaking_queue
      WHERE user_id = ? AND status = 'searching'
      AND queue_joined_at > datetime('now', '-5 minutes')
    `, [user.id]);

    if (existing)
      return reply.code(400).send({error: 'Already in matchmaking queue'});

    const {
      powerups_enabled = false,
      points_to_win = 5,
      board_variant = 'classic'
    } = request.body;

    const settings = { powerups_enabled, points_to_win, board_variant };

    await pongService.db.run(`
      DELETE FROM matchmaking_queue WHERE user_id = ?  
    `, [user.id]);

    await pongService.db.run(`
      INSERT INTO matchmaking_queue (user_id, preferred_game_settings, queue_joined_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `, [user.id, JSON.stringify(settings)]);

    pongService.matchmakingQueue.add(user.id);

    return { success: true };
  });

  fastify.get('/matchmaking/status', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const status = await pongService.db.get(`
      SELECT status FROM matchmaking_queue 
      WHERE user_id = ? AND queue_joined_at > datetime('now', '-5 minutes')
    `, [user.id]);

    return { 
      status: status ? status.status : 'not_in_queue',
      in_queue: !!status
    };
  });

  fastify.post('/matchmaking/leave', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    await pongService.removeUserFromQueue(user.id);

    return { success: true };
  });

  fastify.post('/tournament/create', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { tournament_settings } = request.body;

    const { 
      powerups_enabled = false, 
      points_to_win = 5, 
      board_variant = 'classic', 
      num_players = 4, 
      aliases = [] 
    } = tournament_settings || {};

    console.log('Creating tournament with settings:', {
      tournament_settings
    });

    if (tournament_settings.gameMode === 'local') {
      if (!Array.isArray(aliases)) {
        return reply.code(400).send({ error: 'Aliases must be an array' });
      }
      
      if (num_players < 4 || num_players > 16 || num_players % 2 !== 0 || aliases.length !== num_players) {
        return reply.code(400).send({ 
          error: 'Invalid local tournament parameters',
          details: {
            num_players,
            aliases_length: aliases.length,
            requirements: 'Must have 4-16 players (even number) and matching aliases'
          }
        });
      }
    }

    try {
      const tournamentResult = await pongService.db.run(`
        INSERT INTO tournaments (name, creator_id, max_participants, tournament_settings, status, created_at) 
        VALUES (?, ?, ?, ?, 'registration', CURRENT_TIMESTAMP)
      `, [tournament_settings.name, user.id, tournament_settings.max_participants || num_players, JSON.stringify({...tournament_settings})]);

      const tournamentId = tournamentResult.lastID;

      if (tournament_settings.gameMode === 'local') {
        console.log('Creating guest users for local tournament:', aliases);
        try {
          for (const alias of aliases) {
            const guestResult = await pongService.db.run(`
              INSERT INTO users (display_name, username, email, is_guest, created_at) 
              VALUES (?, NULL, NULL, TRUE, CURRENT_TIMESTAMP)
            `, [alias]);

            const guestId = guestResult.lastID;
            console.log(`Created guest user: ${alias} with ID: ${guestId}`);

            if (!guestId) {
              throw new Error(`Failed to get ID for guest user: ${alias}`);
            }

            await pongService.db.run(`
              INSERT INTO tournament_participants (tournament_id, user_id, registered_at) 
              VALUES (?, ?, CURRENT_TIMESTAMP)
            `, [tournamentId, guestId]);

            console.log(`Added guest ${guestId} to tournament participants`);
          }
        } catch (error) {
          console.error('Error creating guest users:', error);
          throw error;
        }
      }
      else {
        await pongService.db.run(`
          INSERT INTO tournament_participants (tournament_id, user_id, registered_at) 
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `, [tournamentId, user.id]);
      }

      pongService.createTournament(tournamentId, { 
        tournament_settings: {...tournament_settings}
      });

      return { tournament_id: tournamentId };
    } catch (error) {
      console.error('Error creating tournament:', error);
      return reply.code(500).send({ error: 'Failed to create tournament: ' + error.message });
    }
  });

  fastify.post('/tournament/join/:tournamentId', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const tournamentId = parseInt(request.params.tournamentId);

    const tournament = await pongService.db.get('SELECT * FROM tournaments WHERE id = ?', [tournamentId]);

    if (!tournament || tournament.status !== 'registration') {
      return reply.code(400).send({ error: 'Invalid tournament' });
    }

    const settings = JSON.parse(tournament.tournament_settings);
    if (settings.gameMode === 'local') {
      return reply.code(400).send({ error: 'Cannot join local tournament' });
    }

    const existing = await pongService.db.get(`
      SELECT * FROM tournament_participants 
      WHERE tournament_id = ? AND user_id = ?
    `, [tournamentId, user.id]);

    if (existing) {
      return reply.code(400).send({ error: 'Already joined' });
    }

    const participantsCount = await pongService.db.get(`
      SELECT COUNT(*) as count FROM tournament_participants WHERE tournament_id = ?
    `, [tournamentId]);

    if (participantsCount.count >= tournament.max_participants) {
      return reply.code(400).send({ error: 'Tournament full' });
    }

    await pongService.db.run(`
      INSERT INTO tournament_participants (tournament_id, user_id, registered_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `, [tournamentId, user.id]);

    const participants = await pongService.db.all(`
      SELECT u.id, u.display_name, u.is_guest 
      FROM tournament_participants tp
      JOIN users u ON u.id = tp.user_id
      WHERE tp.tournament_id = ?
    `, [tournamentId]);

    pongService.broadcastToAllUsers({
      type: 'tournament_joined',
      tournament_id: tournamentId,
      participants: participants
    });

    return { success: true };
  });

  fastify.post('/tournament/:tournamentId/leave', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const tournamentId = parseInt(request.params.tournamentId);
    
    try {
      const tournament = await pongService.db.get('SELECT * FROM tournaments WHERE id = ?', [tournamentId]);
      
      if (!tournament) {
        return reply.code(404).send({ error: 'Tournament not found' });
      }
      
      if (tournament.creator_id === user.id) {
        return reply.code(400).send({ error: 'Tournament creator cannot leave the tournament' });
      }
      
      if (tournament.status !== 'registration') {
        return reply.code(400).send({ error: 'Cannot leave tournament after it has started' });
      }

      await pongService.db.run(`
        DELETE FROM tournament_participants 
        WHERE tournament_id = ? AND user_id = ?
      `, [tournamentId, user.id]);

      const participants = await pongService.db.all(`
        SELECT u.id, u.display_name, u.is_guest 
        FROM tournament_participants tp
        JOIN users u ON u.id = tp.user_id
        WHERE tp.tournament_id = ?
      `, [tournamentId]);

      pongService.broadcastToAllUsers({
        type: 'tournament_joined',
        tournament_id: tournamentId,
        participants: participants
      });

      return { success: true };
    } catch (error) {
      console.error('Error leaving tournament:', error);
      return reply.code(500).send({ error: 'Failed to leave tournament' });
    }
  });

  fastify.delete('/tournament/:tournamentId', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const tournamentId = parseInt(request.params.tournamentId);
    const tournament = await pongService.db.get('SELECT * FROM tournaments WHERE id = ?', [tournamentId]);
    if (!tournament || tournament.creator_id !== user.id || tournament.status !== 'registration' ) {
      if (tournament.status !== 'registration')
          return reply.code(400).send({ error: 'Cannot delete a tournament that has started' });
      else
        return reply.code(403).send({ error: 'Not authorized to delete this tournament' });
    }

    await pongService.db.run('DELETE FROM tournament_participants WHERE tournament_id = ?', [tournamentId]);
    await pongService.db.run('DELETE FROM tournaments WHERE id = ?', [tournamentId]);

    pongService.tournaments.delete(tournamentId);

    return { success: true };
  });

  fastify.get('/tournament/:tournamentId/participants', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const tournamentId = parseInt(request.params.tournamentId);
    try {
      console.log(`Fetching participants for tournament ${tournamentId}`);
      const participants = await pongService.db.all(`
        SELECT u.id, u.display_name, u.is_guest 
        FROM tournament_participants tp
        JOIN users u ON u.id = tp.user_id
        WHERE tp.tournament_id = ?
        ORDER BY tp.registered_at
      `, [tournamentId]);

      console.log(`Found ${participants.length} participants for tournament ${tournamentId}`);
      return participants;
    } catch (error) {
      console.error('Error fetching participants:', error);
      return reply.code(500).send({ error: 'Failed to fetch participants' });
    }
  });

  fastify.get('/tournament/:tournamentId', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const tournamentId = parseInt(request.params.tournamentId);
    const tournament = await pongService.db.get(`
      SELECT t.*, u.display_name as winner_name 
      FROM tournaments t
      LEFT JOIN users u ON u.id = t.winner_id
      WHERE t.id = ?
    `, [tournamentId]);
    
    if (!tournament) {
      return reply.code(404).send({ error: 'Tournament not found' });
    }

    const matches = await pongService.db.all(`
      SELECT tm.*, 
        u1.display_name AS player1_name, 
        u2.display_name AS player2_name,
        u3.display_name AS winner_name,  -- Add winner name
        gs.final_score_player1 AS score1,
        gs.final_score_player2 AS score2
      FROM tournament_matches tm
      LEFT JOIN users u1 ON u1.id = tm.player1_id
      LEFT JOIN users u2 ON u2.id = tm.player2_id
      LEFT JOIN users u3 ON u3.id = tm.winner_id  -- Join for winner name
      LEFT JOIN game_sessions gs ON gs.id = tm.game_session_id
      WHERE tm.tournament_id = ?
    `, [tournamentId]);

    return {
      ...tournament,
      matches,
      tournament_settings: JSON.parse(tournament.tournament_settings),
    };
  });

  fastify.post('/tournament/start/:tournamentId', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const tournamentId = parseInt(request.params.tournamentId);

    const tournament = await pongService.db.get('SELECT * FROM tournaments WHERE id = ?', [tournamentId]);

    if (!tournament || tournament.creator_id !== user.id || tournament.status !== 'registration') {
      return reply.code(400).send({ error: 'Invalid operation' });
    }
    
    const participantsCount = await pongService.db.get(`
      SELECT COUNT(*) as count FROM tournament_participants WHERE tournament_id = ?
    `, [tournamentId]);

    if (participantsCount.count < 4 || participantsCount.count % 2 !== 0) {
      return reply.code(400).send({ error: 'Invalid participant count' });
    }

    const t = pongService.tournaments.get(tournamentId);
    if (t) {
      await t.startTournament();
    }

    pongService.broadcastToAllUsers({
      type: 'tournament_started',
      tournament_id: tournamentId,
    });

    return { success: true };
  });

  fastify.post('/tournament/match/start/:matchId', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const matchId = parseInt(request.params.matchId);

    const match = await pongService.db.get('SELECT * FROM tournament_matches WHERE id = ?', [matchId]);

    if (!match) {
      return reply.code(400).send({ error: 'Invalid match' });
    }

    const tournament = await pongService.db.get('SELECT * FROM tournaments WHERE id = ?', [match.tournament_id]);

    const isParticipant = match.player1_id === user.id || match.player2_id === user.id;

    // if (tournament.creator_id !== user.id) {
    //   return reply.code(403).send({ error: 'Not authorized' });
    // }

    const settings = JSON.parse(tournament.tournament_settings);
    if (settings.gameMode === 'local') {
      if (tournament.creator_id !== user.id) {
        return reply.code(403).send({ error: 'Not authorized' });
      }
    } else {
      if (!isParticipant) {
        return reply.code(403).send({ error: 'You are not a participant in this match' });
      }
    }

    const t = pongService.tournaments.get(match.tournament_id);
    if (t) {
      const gameId = await t.startMatch(matchId);
      return { game_id: gameId };
    }

    return reply.code(500).send({ error: 'Failed to start match' });
  });

  fastify.get('/tournaments/open', async (request, reply) => {
    const openTournaments = await pongService.db.all(`
      SELECT * FROM tournaments 
      WHERE status = 'registration'
    `);

    return openTournaments;
  });

  fastify.post('/notify/friend-request', async (request, reply) => {
    const { type, requesterId, addresseeId, requestId } = request.body;
    try {
      if (type === 'sent') {
        await pongService.notifyFriendRequestSent(requesterId, addresseeId, requestId);
      } else if (type === 'accepted') {
        await pongService.notifyFriendRequestAccepted(requesterId, addresseeId);
      } else if (type === 'rejected') {
        await pongService.notifyFriendRequestRejected(requesterId, addresseeId);
      }
      return { success: true };
    } catch (error) {
      console.error('Error sending friend notification:', error);
      return reply.code(500).send({ error: 'Failed to send notification' });
    }
  });

  fastify.get('/wss', { websocket: true }, (connection, request) => {
    console.log('New WebSocket connection attempt');
    console.log('Query parameters:', request.query);
    console.log('Game ID from query:', request.query.game_id);

    let authenticated = false;
    let userId = null;
    let user = null; //AHHHHH CHANGE IT BEACK TO CONST LATER
    let playerNumber = null; //AND THIS
    let gameId = parseInt(request.query.game_id);

    const authTimeout = setTimeout(() => {
      if (!authenticated) connection.close(4001, 'Authentication timeout');
    }, 5000);

    if (!gameId || isNaN(gameId)) {
      console.error('Invalid game ID:', request.query.game_id);
      connection.close(4000, 'Game ID required');
      return;
    }

    const gameRoom = pongService.gameRooms.get(gameId);
    if (!gameRoom) {
      console.error('Game room not found for ID:', gameId);
      // console.log('Available game rooms:', Array.from(pongService.gameRooms.keys()));
      connection.close(4004, 'Game not found');
      return;
    }
    // console.log('Found game room:', gameId);
    // console.log('Game room options:', gameRoom.options);

     if (gameRoom.gameState.status === 'finished' || gameRoom.gameState.status === 'abandoned') {
      console.log(`Game ${gameId} is already finished, rejecting connection`);
      connection.close(4006, 'Game already finished');
      return;
    }

    if (gameRoom.options.gameMode === 'local') {
      console.log('Local game detected, bypassing auth');
      authenticated = true;
      userId = `local_${Date.now()}_${Math.random()}`;
      
      gameRoom.addConnection(userId, connection);
      connection.send(JSON.stringify({
        type: 'auth_success',
        user_id: userId,
        gameMode: 'local'
      }));
    } else {
      // console.log('Online game, requiring auth');
      connection.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'auth' && data.token) {
            user = await validateToken(data.token);
            if (user) {
              authenticated = true;
              userId = user.id;
              clearTimeout(authTimeout);

              const participant = await pongService.db.get(`
                SELECT player_number FROM game_participants 
                WHERE game_session_id = ? AND user_id = ?
              `, [gameId, userId]);

              if (!participant) {
                console.error(`User ${userId} is not a participant in game ${gameId}`);
                connection.close(4005, 'Not a participant in this game');
                return;
              }

              playerNumber = participant.player_number;

              if (gameRoom.connections.has(userId)) {
                console.warn(`User ${userId} already connected to game ${gameId}`);
                connection.close(4003, 'Already connected to this game');
                return;
              }
              
              gameRoom.addPlayer(userId, playerNumber);
              gameRoom.addConnection(userId, connection);
              connection.send(JSON.stringify({
                type: 'auth_success',
                user_id: userId,
                gameMode: 'online',
                player_number: playerNumber,
              }));  
              
              console.log(`User ${userId} connected as player ${playerNumber}`);

            } else {
              connection.close(4002, 'Invalid token');
            }
          }
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
        }
      });
    }

    connection.on('message', async (message) => {
      if (!authenticated) return;
      
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'refresh')
        {
            console.log('Received message from user', userId, ':', data);
            gameRoom.handlePlayerDisconnection(userId, 'refresh');
        }
        if (data.type === 'paddle_move') {
            gameRoom.handlePlayerInput(userId, data);
        }
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
      }
    });

    connection.on('close', () => {
      clearTimeout(authTimeout);
      if (authenticated && userId) {
        pongService.removeUserConnection(userId);
        pongService.removeUserFromQueue(userId);
      }
      if (authenticated && gameId) {
        const gameRoom = pongService.gameRooms.get(gameId);
        if (gameRoom) {
          gameRoom.removeConnection(userId);
        }
      }
    });
  });

  fastify.get('/ws/user', { websocket: true }, (connection, request) => {
    let authenticated = false;
    let userId = null;

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
            pongService.addUserConnection(userId, connection);
            connection.send(JSON.stringify({ type: 'auth_success' }));
          } else {
            connection.close(4002, 'Invalid token');
          }
        }
      } catch (error) {
        console.error('Invalid user WebSocket message:', error);
      }
    });

    connection.on('close', () => {
      clearTimeout(authTimeout);
      if (authenticated && userId) {
        pongService.removeUserConnection(userId);
        pongService.removeUserFromQueue(userId);
      }
    });
  });
}

module.exports = { setupRoutes };
