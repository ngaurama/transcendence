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
      powerups_enabled = false,
      points_to_win = 5,
      board_variant = 'classic'
    } = request.body;

    try {
      const gameSettings = {
        powerups_enabled,
        points_to_win,
        board_variant
      };

      const gameResult = await pongService.db.run(`
        INSERT INTO game_sessions (status, game_settings, created_at) 
        VALUES ('waiting', ?, CURRENT_TIMESTAMP)
      `, [JSON.stringify(gameSettings)]);

      const gameId = gameResult.lastID;

      await pongService.db.run(`
        INSERT INTO game_participants (game_session_id, user_id, player_number) 
        VALUES (?, ?, 1)
      `, [gameId, user.id]);

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
        // Create guest user for opponent
        const guestResult = await pongService.db.run(`
          INSERT INTO users (display_name, is_guest, created_at) 
          VALUES (?, TRUE, CURRENT_TIMESTAMP)
        `, [player2_name || 'Opponent']);

        const guestId = guestResult.lastID;

        await pongService.db.run(`
          INSERT INTO game_participants (game_session_id, user_id, player_number) 
          VALUES (?, ?, 2)
        `, [gameId, guestId]);
      }

      return { game_id: gameId };
    } catch (error) {
      console.error('Error creating game:', error);
      return reply.code(500).send({ error: 'Failed to create game' });
    }
  });

  // In routes/pong-routes.js - Add new endpoint
  fastify.get('/game-history', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    try {
      const games = await pongService.db.all(`
        SELECT 
          gs.id,
          gs.created_at,
          gs.final_score_player1,
          gs.final_score_player2,
          gs.game_duration_ms,
          gs.game_settings,
          gs.tournament_id,
          gp1.user_id as player1_id,
          gp2.user_id as player2_id,
          u1.display_name as player1_name,
          u2.display_name as player2_name,
          CASE 
            WHEN gs.winner_id = ? THEN 'win'
            WHEN gs.winner_id IS NULL THEN 'draw'
            ELSE 'loss'
          END as result
        FROM game_sessions gs
        LEFT JOIN game_participants gp1 ON gp1.game_session_id = gs.id AND gp1.player_number = 1
        LEFT JOIN game_participants gp2 ON gp2.game_session_id = gs.id AND gp2.player_number = 2
        LEFT JOIN users u1 ON u1.id = gp1.user_id
        LEFT JOIN users u2 ON u2.id = gp2.user_id
        WHERE gs.id IN (
          SELECT game_session_id 
          FROM game_participants 
          WHERE user_id = ?
        )
        AND gs.status = 'completed'
        ORDER BY gs.created_at DESC
        LIMIT 50
      `, [user.id, user.id]);

      const history = games.map(game => ({
        id: game.id,
        date: new Date(game.created_at),
        opponent: game.player1_id === user.id ? game.player2_name : game.player1_name,
        result: game.result,
        score: `${game.final_score_player1}-${game.final_score_player2}`,
        duration: game.game_duration_ms,
        options: JSON.parse(game.game_settings),
        tournament_id: game.tournament_id
      }));

      return history;
    } catch (error) {
      console.error('Error fetching game history:', error);
      return reply.code(500).send({ error: 'Failed to fetch game history' });
    }
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

    const { powerups_enabled, points_to_win } = request.body;

    const settings = { powerups_enabled, points_to_win };

    await pongService.db.run(`
      INSERT INTO matchmaking_queue (user_id, preferred_game_settings, queue_joined_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `, [user.id, JSON.stringify(settings)]);

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
      console.log("ENTERED HERE YEAHH");
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

            // Get the last inserted ID properly
            const guestId = guestResult.lastID;
            console.log(`Created guest user: ${alias} with ID: ${guestId}`);

            if (!guestId) {
              throw new Error(`Failed to get ID for guest user: ${alias}`);
            }

            // Then add to tournament participants
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

    return { success: true };
  });

  // fastify.get('/tournament/:tournamentId/bracket-data', async (request, reply) => {
  //   const token = request.headers.authorization?.replace('Bearer ', '');
  //   const user = await validateToken(token);
  //   if (!user) {
  //     return reply.code(401).send({ error: 'Authentication required' });
  //   }

  //   const tournamentId = parseInt(request.params.tournamentId);
    
  //   try {
  //     // Get tournament details
  //     const tournament = await pongService.db.get('SELECT * FROM tournaments WHERE id = ?', [tournamentId]);
  //     if (!tournament) {
  //       return reply.code(404).send({ error: 'Tournament not found' });
  //     }

  //     // Get participants
  //     const participants = await pongService.db.all(`
  //       SELECT u.id, u.display_name 
  //       FROM tournament_participants tp
  //       JOIN users u ON u.id = tp.user_id
  //       WHERE tp.tournament_id = ?
  //       ORDER BY tp.registered_at
  //     `, [tournamentId]);

  //     // Get matches
  //     const matches = await pongService.db.all(`
  //       SELECT tm.*, u1.display_name as player1_name, u2.display_name as player2_name,
  //             uw.display_name as winner_name,
  //             gs.final_score_player1 as score1,
  //             gs.final_score_player2 as score2
  //       FROM tournament_matches tm
  //       LEFT JOIN users u1 ON u1.id = tm.player1_id
  //       LEFT JOIN users u2 ON u2.id = tm.player2_id
  //       LEFT JOIN users uw ON uw.id = tm.winner_id
  //       LEFT JOIN game_sessions gs ON gs.id = tm.game_session_id
  //       WHERE tm.tournament_id = ?
  //       ORDER BY tm.round_number, tm.match_number
  //     `, [tournamentId]);

  //     // Convert to brackets-viewer format
  //     const stages = [{
  //       id: 1,
  //       tournament_id: tournamentId,
  //       name: 'Main Bracket',
  //       type: 'single_elimination',
  //       number: 1,
  //       settings: {
  //         size: tournament.max_participants,
  //         matchesChildCount: 0
  //       }
  //     }];

  //     const formattedMatches = matches.map(match => ({
  //       id: match.id,
  //       number: match.match_number,
  //       stage_id: 1,
  //       group_id: 1,
  //       round_id: match.round_number,
  //       child_count: 0,
  //       status: match.status === 'completed' ? 3 : match.status === 'in_progress' ? 2 : 1,
  //       opponent1: match.player1_id ? {
  //         id: match.player1_id,
  //         result: match.winner_id === match.player1_id ? 'win' : match.status === 'completed' ? 'loss' : undefined,
  //         score: match.score1
  //       } : null,
  //       opponent2: match.player2_id ? {
  //         id: match.player2_id,
  //         result: match.winner_id === match.player2_id ? 'win' : match.status === 'completed' ? 'loss' : undefined,
  //         score: match.score2
  //       } : null
  //     }));

  //     const formattedParticipants = participants.map(participant => ({
  //       id: participant.id,
  //       tournament_id: tournamentId,
  //       name: participant.display_name
  //     }));

  //     return {
  //       stages,
  //       matches: formattedMatches,
  //       matchGames: [],
  //       participants: formattedParticipants
  //     };

  //   } catch (error) {
  //     console.error('Error fetching bracket data:', error);
  //     return reply.code(500).send({ error: 'Failed to fetch bracket data' });
  //   }
  // });

  fastify.post('/tournament/:tournamentId/leave', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const tournamentId = parseInt(request.params.tournamentId);
    
    try {
      const tournament = await pongService.db.get('SELECT * FROM tournaments WHERE id = ?', [tournamentId]);
      if (!tournament || tournament.status !== 'registration') {
        return reply.code(400).send({ error: 'Cannot leave this tournament' });
      }

      await pongService.db.run(`
        DELETE FROM tournament_participants 
        WHERE tournament_id = ? AND user_id = ?
      `, [tournamentId, user.id]);

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
    if (!tournament || tournament.creator_id !== user.id ) {
      // || tournament.status !== 'registration' //add this back later
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

    console.log("TOURNAMENT IN PLAIN Id: ", tournament);

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

  // fastify.get('/tournament/:tournamentId', async (request, reply) => {
  //   const token = request.headers.authorization?.replace('Bearer ', '');
  //   const user = await validateToken(token);
  //   if (!user) {
  //     return reply.code(401).send({ error: 'Authentication required' });
  //   }

  //   const tournamentId = parseInt(request.params.tournamentId);
  //   const tournament = await pongService.db.get('SELECT * FROM tournaments WHERE id = ?', [tournamentId]);
  //   if (!tournament) {
  //     return reply.code(404).send({ error: 'Tournament not found' });
  //   }

  //   console.log("TOURNAMENT IN PLAIN Id: ", tournament);

  //   const matches = await pongService.db.all(`
  //     SELECT tm.*, 
  //       u1.display_name AS player1_name, 
  //       u2.display_name AS player2_name,
  //       gs.final_score_player1 AS score1,
  //       gs.final_score_player2 AS score2
  //     FROM tournament_matches tm
  //     LEFT JOIN users u1 ON u1.id = tm.player1_id
  //     LEFT JOIN users u2 ON u2.id = tm.player2_id
  //     LEFT JOIN game_sessions gs ON gs.id = tm.game_session_id
  //     WHERE tm.tournament_id = ?
  //   `, [tournamentId]);

  //   return {
  //     ...tournament,
  //     matches,
  //     tournament_settings: JSON.parse(tournament.tournament_settings),
  //   };
  // });

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

    console.log("TOURNAMENT FROM WHEN START MATCH IS CALLED: ", tournament);

    if (tournament.creator_id !== user.id) {
      return reply.code(403).send({ error: 'Not authorized' });
    }

    const settings = JSON.parse(tournament.tournament_settings);
    if (settings.gameMode !== 'local') {
      return reply.code(400).send({ error: 'Only for local tournaments' });
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

  fastify.get('/stats', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const stats = await pongService.db.get('SELECT * FROM user_game_stats WHERE user_id = ?', [user.id]);

    const gamesList = await pongService.db.all(`
      SELECT gs.*, gp1.score as player1_score, gp2.score as player2_score, u1.display_name as player1_name, u2.display_name as player2_name 
      FROM game_sessions gs 
      LEFT JOIN game_participants gp1 ON gp1.game_session_id = gs.id AND gp1.player_number = 1 
      LEFT JOIN game_participants gp2 ON gp2.game_session_id = gs.id AND gp2.player_number = 2 
      LEFT JOIN users u1 ON u1.id = gp1.user_id 
      LEFT JOIN users u2 ON u2.id = gp2.user_id 
      WHERE gs.id IN (SELECT game_session_id FROM game_participants WHERE user_id = ?) 
      ORDER BY gs.ended_at DESC
    `, [user.id]);

    const winsWithPowerups = await pongService.db.get(`
      SELECT COUNT(*) as count FROM game_sessions 
      WHERE winner_id = ? AND json_extract(game_settings, '$.powerups_enabled') = true
    `, [user.id]);

    const winsWithoutPowerups = await pongService.db.get(`
      SELECT COUNT(*) as count FROM game_sessions 
      WHERE winner_id = ? AND json_extract(game_settings, '$.powerups_enabled') = false
    `, [user.id]);

    const mostWinsVariant = await pongService.db.get(`
      SELECT json_extract(game_settings, '$.board_variant') as variant, COUNT(*) as count 
      FROM game_sessions 
      WHERE winner_id = ? 
      GROUP BY variant 
      ORDER BY count DESC LIMIT 1
    `, [user.id]);

    const tournamentsCreated = await pongService.db.get(`
      SELECT COUNT(*) as count FROM tournaments WHERE creator_id = ?
    `, [user.id]);

    const tournamentsPlayed = await pongService.db.get(`
      SELECT COUNT(*) as count FROM tournament_participants WHERE user_id = ?
    `, [user.id]);

    const tournamentsWon = await pongService.db.get(`
      SELECT COUNT(*) as count FROM tournaments WHERE winner_id = ?
    `, [user.id]);

    return {
      ...stats,
      games_list: gamesList,
      wins_with_powerups: winsWithPowerups.count,
      wins_without_powerups: winsWithoutPowerups.count,
      most_wins_variant: mostWinsVariant,
      tournaments_created: tournamentsCreated.count,
      tournaments_played: tournamentsPlayed.count,
      tournaments_won: tournamentsWon.count
      // Add graphs data if needed
    };
  });

  fastify.get('/wss', { websocket: true }, (connection, request) => {
    console.log('New WebSocket connection attempt');
    console.log('Query parameters:', request.query);
    console.log('Game ID from query:', request.query.game_id);

    let authenticated = false;
    let userId = null;
    let gameId = parseInt(request.query.game_id);

    if (!gameId || isNaN(gameId)) {
      console.error('Invalid game ID:', request.query.game_id);
      connection.close(4000, 'Game ID required');
      return;
    }

    const gameRoom = pongService.gameRooms.get(gameId);
    if (!gameRoom) {
      console.error('Game room not found for ID:', gameId);
      console.log('Available game rooms:', Array.from(pongService.gameRooms.keys()));
      connection.close(4004, 'Game not found');
      return;
    }
    console.log('Found game room:', gameId);
    console.log('Game room options:', gameRoom.options);

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
      console.log('Online game, requiring auth');
      const authTimeout = setTimeout(() => {
        if (!authenticated) connection.close(4001, 'Authentication timeout');
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
              
              gameRoom.addConnection(userId, connection);
              connection.send(JSON.stringify({
                type: 'auth_success',
                user_id: userId,
                gameMode: 'online'
              }));
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
        if (data.type === 'paddle_move') {
          gameRoom.handlePlayerInput(userId, data);
        }
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
      }
    });

    connection.on('close', () => {
      if (authenticated && gameId) {
        const gameRoom = pongService.gameRooms.get(gameId);
        if (gameRoom) {
          gameRoom.removeConnection(userId);
        }
      }
    });
  });

  // Global WebSocket for notifications
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
      }
    });
  });
}

module.exports = { setupRoutes };
