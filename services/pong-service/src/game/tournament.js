// game/tournament.js
class Tournament {
  constructor(tournamentId, db, options, pongService) {
    this.tournamentId = tournamentId;
    this.db = db;
    this.options = options;
    this.pongService = pongService;
    this.currentRound = 1;
    this.activePlayers = [];
  }

  async startTournament() {
    try {
      await this.db.run(`
        UPDATE tournaments 
        SET status = 'in_progress', starts_at = CURRENT_TIMESTAMP, current_round = 1,
            total_rounds = ? 
        WHERE id = ?
      `, [Math.ceil(Math.log2(this.options.tournament_settings.max_participants)), this.tournamentId]);

      const participants = await this.db.all(`
        SELECT user_id FROM tournament_participants 
        WHERE tournament_id = ?
      `, [this.tournamentId]);

      this.activePlayers = participants.map(p => p.user_id);

      await this.createNextRoundMatches();
    } catch (error) {
      console.error('Error starting tournament:', error);
    }
  }

  async createNextRoundMatches() {
    try {
      let players = [...this.activePlayers];

      if (players.length === 0) return;

      if (players.length % 2 === 1) {
        players.push(null);
      }

      for (let i = 0; i < players.length; i += 2) {
        const player1 = players[i];
        const player2 = players[i + 1];

        const matchResult = await this.db.run(`
          INSERT INTO tournament_matches 
          (tournament_id, round_number, match_number, player1_id, player2_id, status) 
          VALUES (?, ?, ?, ?, ?, ?)
        `, [this.tournamentId, this.currentRound, i / 2 + 1, player1, player2, (player1 == null || player2 == null) ? 'completed' : 'pending']);

        const matchId = matchResult.lastID;

        if (player1 == null && player2 != null) {
          await this.db.run(`
            UPDATE tournament_matches
            SET winner_id = ?, completed_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [player2, matchId]);
        } else if (player2 == null && player1 != null) {
          await this.db.run(`
            UPDATE tournament_matches 
            SET winner_id = ?, completed_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `, [player1, matchId]);
        } else if (player1 != null && player2 != null) {
          // if (this.options.tournament_settings.gameMode === 'local') {
          //   await this.startMatch(matchId);
          // }
          if (this.options.tournament_settings.gameMode === 'online') {
            const gameSettings = this.options.tournament_settings;
            const gameResult = await this.db.run(`
              INSERT INTO game_sessions (tournament_id, status, game_settings, created_at) 
              VALUES (?, 'waiting', ?, CURRENT_TIMESTAMP)
            `, [this.tournamentId, JSON.stringify(gameSettings)]);

            const gameId = gameResult.lastID;

            await this.db.run(`
              INSERT INTO game_participants (game_session_id, user_id, player_number) 
              VALUES (?, ?, 1), (?, ?, 2)
            `, [gameId, player1, gameId, player2]);

            await this.db.run(`
              UPDATE tournament_matches 
              SET game_session_id = ? 
              WHERE id = ?
            `, [gameId, matchId]);

            const player1Name = await this.pongService.getDisplayName(player1);
            const player2Name = await this.pongService.getDisplayName(player2);

            this.pongService.createGame(gameId, { 
              ...gameSettings, 
              gameMode: 'online', 
              tournament_id: this.tournamentId,
              player1_name: player1Name,
              player2_name: player2Name
            });

            this.pongService.sendToUser(player1, {
              type: 'tournament_match_ready',
              tournament_id: this.tournamentId,
              match_id: matchId,
              game_id: gameId,
              opponent_id: player2,
              opponent_name: player2Name
            });

            this.pongService.sendToUser(player2, {
              type: 'tournament_match_ready',
              tournament_id: this.tournamentId,
              match_id: matchId,
              game_id: gameId,
              opponent_id: player1,
              opponent_name: player1Name
            });
          }
        }
      }

      await this.db.run(`
        UPDATE tournaments 
        SET current_round = ? 
        WHERE id = ?
      `, [this.currentRound, this.tournamentId]);
    } catch (error) {
      console.error('Error creating next round matches:', error);
    }
  }

  async checkRoundCompletion() {
    const matches = await this.db.all(`
      SELECT status FROM tournament_matches 
      WHERE tournament_id = ? AND round_number = ?
    `, [this.tournamentId, this.currentRound]);

    if (matches.every(m => m.status === 'completed')) {
      const winners = await this.db.all(`
        SELECT winner_id FROM tournament_matches 
        WHERE tournament_id = ? AND round_number = ?
      `, [this.tournamentId, this.currentRound]);

      this.activePlayers = winners.map(w => w.winner_id).filter(id => id != null);

      if (this.activePlayers.length === 1) {
        await this.endTournament(this.activePlayers[0]);
      } else {
        this.currentRound++;
        await this.createNextRoundMatches();
      }
      await this.broadcastUpdate();
    }
  }

  async endTournament(winnerId) {
    await this.db.run(`
      UPDATE tournaments 
      SET status = 'completed', winner_id = ?, ends_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [winnerId, this.tournamentId]);

    // Update stats for tournament
    const participants = await this.db.all(`
      SELECT user_id FROM tournament_participants 
      WHERE tournament_id = ?
    `, [this.tournamentId]);

    for (const { user_id } of participants) {
      if (user_id) {
        await this.updateUserStats(user_id, { tournaments_played: 1 });
        if (user_id === winnerId) {
          await this.updateUserStats(user_id, { tournaments_won: 1 });
        }
      }
    }
    this.broadcastUpdate();
  }

  async updateUserStats(userId, updates) {
    const existing = await this.db.get('SELECT * FROM user_game_stats WHERE user_id = ?', [userId]);
    if (existing) {
      let sql = 'UPDATE user_game_stats SET ';
      const params = [];
      Object.keys(updates).forEach(key => {
        sql += `${key} = ${key} + ?, `;
        params.push(updates[key]);
      });
      sql = sql.slice(0, -2) + ' WHERE user_id = ?';
      params.push(userId);
      await this.db.run(sql, params);
    } else {
      // Insert new
    }
  }

  async broadcastUpdate() {
    const participants = await this.db.all(`
      SELECT user_id FROM tournament_participants 
      WHERE tournament_id = ?
    `, [this.tournamentId]);

    const message = {
      type: 'tournament_update',
      tournament_id: this.tournamentId
      // Add more details if needed
    };

    for (const { user_id } of participants) {
      if (user_id) {
        this.pongService.sendToUser(user_id, message);
      }
    }
  }

  async startMatch(matchId) {
    const match = await this.db.get(`
      SELECT tm.*,
        u1.display_name AS player1_name,
        u2.display_name AS player2_name
      FROM tournament_matches tm
      LEFT JOIN users u1 ON tm.player1_id = u1.id
      LEFT JOIN users u2 ON tm.player2_id = u2.id
      WHERE tm.id = ? AND tm.tournament_id = ?
    `, [matchId, this.tournamentId]);

    if (match.status !== 'pending') return match.game_session_id;
    
    await this.db.run(`
      UPDATE tournament_matches 
      SET status = 'in_progress', started_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [matchId]);

    const gameSettings = this.options.tournament_settings;

    const gameResult = await this.db.run(`
      INSERT INTO game_sessions (tournament_id, status, game_settings, created_at) 
      VALUES (?, 'waiting', ?, CURRENT_TIMESTAMP)
    `, [this.tournamentId, JSON.stringify(gameSettings)]);

    const gameId = gameResult.lastID;

    await this.db.run(`
      INSERT INTO game_participants (game_session_id, user_id, player_number) 
      VALUES (?, ?, 1), (?, ?, 2)
    `, [gameId, match.player1_id, gameId, match.player2_id]);

    await this.db.run(`
      UPDATE tournament_matches 
      SET game_session_id = ? 
      WHERE id = ?
    `, [gameId, matchId]);

    this.pongService.createGame(gameId, {
      ...gameSettings, 
      tournament_id: this.tournamentId,
      tournament_match_id: matchId,
      player1_name: match.player1_name,
      player2_name: match.player2_name
    });

    return gameId;
  }
}

module.exports = { Tournament };
