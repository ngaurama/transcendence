// social-service/routes/stats-routes.js
const { validateToken } = require('../utils/auth');

module.exports = function setupStatsRoutes(fastify, socialService) {
  fastify.get('/stats/:user_id?', async (request, reply) => {
  const token = request.headers.authorization?.replace('Bearer ', '');
  const user = await validateToken(token);
  if (!user) {
    return reply.code(401).send({ error: 'Authentication required' });
  }
  try {
    const targetUserId = parseInt(request.params.user_id || user.id);
    const isOwnProfile = targetUserId == user.id;

    const targetUser = await socialService.db.get(`
      SELECT id, username, display_name, avatar_url, created_at
      FROM users WHERE id = ? AND is_active = TRUE
    `, [targetUserId]);

    if (!targetUser) {
      return reply.code(404).send({ error: 'User not found' });
    }

    const stats = await socialService.db.get(`
      SELECT 
        games_played, games_won, games_lost,
        total_playtime_seconds, average_game_duration,
        longest_game_duration, shortest_game_duration,
        current_win_streak, longest_win_streak,
        current_loss_streak, longest_loss_streak,
        tournaments_played, tournaments_won, tournaments_top3,
        pong_stats
      FROM user_game_stats WHERE user_id = ?
    `, [targetUserId]);

    const winLossByType = await socialService.db.all(`
      SELECT 
        json_extract(gs.game_settings, '$.powerups_enabled') AS powerups_enabled,
        json_extract(gs.game_settings, '$.board_variant') AS board_variant,
        COUNT(*) AS total_games,
        SUM(
          CASE 
            WHEN gs.winner_id = ? THEN 1
            WHEN gs.winner_id IS NULL 
              AND ((? = gs.player1_id AND gs.final_score_player1 > gs.final_score_player2) 
                    OR (? = gs.player2_id AND gs.final_score_player2 > gs.final_score_player1))
            THEN 1
            ELSE 0
          END
        ) AS wins,
        SUM(
          CASE 
            WHEN gs.winner_id IS NOT NULL AND gs.winner_id != ? THEN 1
            WHEN gs.winner_id IS NULL 
              AND ((? = gs.player1_id AND gs.final_score_player1 < gs.final_score_player2) 
                    OR (? = gs.player2_id AND gs.final_score_player2 < gs.final_score_player1))
            THEN 1
            ELSE 0
          END
        ) AS losses
      FROM game_sessions gs
      WHERE (? IN (gs.player1_id, gs.player2_id)) 
        AND gs.status = 'completed'
      GROUP BY powerups_enabled, board_variant;
    `, [
      targetUserId, targetUserId, targetUserId,
      targetUserId, targetUserId, targetUserId,
      targetUserId
    ]);

    const rawRecentGames = await socialService.db.all(`
      SELECT 
        gs.id, gs.created_at, gs.final_score_player1, gs.final_score_player2,
        gs.game_duration_ms, gs.game_settings, gs.winner_id,
        gs.player1_id, gs.player2_id,
        gs.end_reason,
        u1.display_name AS player1_name, u1.avatar_url AS player1_avatar,
        u2.display_name AS player2_name, u2.avatar_url AS player2_avatar,
        CASE 
          WHEN gs.winner_id = ? THEN 'win'
          WHEN gs.winner_id IS NULL 
            AND ((? = gs.player1_id AND gs.final_score_player1 > gs.final_score_player2) 
                  OR (? = gs.player2_id AND gs.final_score_player2 > gs.final_score_player1))
          THEN 'win'
          ELSE 'loss'
        END AS result,
      FROM game_sessions gs
      LEFT JOIN users u1 ON u1.id = gs.player1_id
      LEFT JOIN users u2 ON u2.id = gs.player2_id
      WHERE (? IN (gs.player1_id, gs.player2_id))
        AND gs.status = 'completed'
      ORDER BY gs.created_at DESC
      LIMIT 20;
    `, [targetUserId, targetUserId, targetUserId, targetUserId]);

    const recentGames = rawRecentGames.map(g => ({
      id: g.id,
      created_at: g.created_at,
      game_duration_ms: g.game_duration_ms,
      game_settings: g.game_settings,
      winner_id: g.winner_id,
      end_reason: g.end_reason,
      player1: {
        id: g.player1_id,
        score: g.final_score_player1,
        name: g.player1_name,
        avatar_url: g.player1_avatar
      },
      player2: {
        id: g.player2_id,
        score: g.final_score_player2,
        name: g.player2_name,
        avatar_url: g.player2_avatar
      },
      result: g.result,
    }));

    const tournamentStats = await socialService.db.all(`
      SELECT 
        t.id, t.name, t.status, t.winner_id,
        tp.final_position, tp.eliminated_in_round,
        CASE 
          WHEN t.winner_id = ? THEN 'winner'
          WHEN tp.final_position <= 3 THEN 'top3'
          ELSE 'participant'
        END as performance
      FROM tournament_participants tp
      JOIN tournaments t ON t.id = tp.tournament_id
      WHERE tp.user_id = ?
      ORDER BY t.created_at DESC
    `, [targetUserId, targetUserId]);

    return {
      targetUser,
      stats: stats || {},
      win_loss_by_type: winLossByType,
      recent_games: recentGames,
      tournament_stats: tournamentStats,
      is_own_profile: isOwnProfile
    };
  } catch (error) {
    console.error('Stats fetch error:', error);
    return reply.code(500).send({ error: 'Failed to fetch statistics' });
  }
});

  fastify.get('/game/:game_id/details', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    try {
      const game_id = parseInt(request.params.game_id);
      
      const gameDetails = await socialService.db.get(`
        SELECT 
          gs.*,
          u1.id as player1_id, u1.display_name as player1_name, u1.avatar_url as player1_avatar,
          u2.id as player2_id, u2.display_name as player2_name, u2.avatar_url as player2_avatar,
          dgs1.pong_stats as player1_stats,
          dgs2.pong_stats as player2_stats
        FROM game_sessions gs
        LEFT JOIN game_participants gp1 ON gp1.game_session_id = gs.id AND gp1.player_number = 1
        LEFT JOIN game_participants gp2 ON gp2.game_session_id = gs.id AND gp2.player_number = 2
        LEFT JOIN users u1 ON u1.id = gp1.id
        LEFT JOIN users u2 ON u2.id = gp2.id
        LEFT JOIN detailed_game_stats dgs1 ON dgs1.game_session_id = gs.id AND dgs1.id = u1.id
        LEFT JOIN detailed_game_stats dgs2 ON dgs2.game_session_id = gs.id AND dgs2.id = u2.id
        WHERE gs.id = ?
      `, [game_id]);

      if (!gameDetails) {
        return reply.code(404).send({ error: 'Game not found' });
      }

      const participant = await socialService.db.get(`
        SELECT * FROM game_participants 
        WHERE game_session_id = ? AND id = ?
      `, [game_id, user.id]);

      if (!participant) {
        return reply.code(403).send({ error: 'Not authorized to view this game' });
      }

      return { game: gameDetails };
    } catch (error) {
      console.error('Game details error:', error);
      return reply.code(500).send({ error: 'Failed to fetch game details' });
    }
  });
};
