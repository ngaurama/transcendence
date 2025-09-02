// game/pong-game.js
const { PowerUpSystem } = require('./power-ups');

class PongGame {
  constructor(gameId, db, options = {}, pongService) {
    this.gameId = gameId;
    this.db = db;
    this.pongService = pongService;
    this.players = new Map();
    this.connections = new Map();
    this.inputStates = { player1: null, player2: null };
    this.canvas = {
      width: options.canvasWidth || 800,
      height: options.canvasHeight || 600
    };
    this.playerNames = {
      player1: options.player1_name || 'Player 1',
      player2: options.player2_name || (options.gameMode === 'local' ? (options.player2_name || 'Player 2') : 'Player 2')
    };
    this.basePaddleStats = {
      speed: this.canvas.width * 0.375, // 300/800
      height: this.canvas.width * 0.125, // 100/800
      width: this.canvas.width * 0.025, // 20/800
      y: this.canvas.height / 2
    };
    this.gameState = {
      ball: {
        x: this.canvas.width / 2,
        y: this.canvas.height / 2,
        dx: this.canvas.width * 0.005, // 4/800
        dy: this.canvas.width * 0.005 // 4/800
      },
      paddles: {
        player1: {
          x: this.canvas.width * 0.05, //5% from the left
          y: this.canvas.height / 2,
          width: this.basePaddleStats.width,
          height: this.basePaddleStats.height,
          speed: this.basePaddleStats.speed
        },
        player2: {
          x: this.canvas.width * 0.95 - this.basePaddleStats.width, //95% from the left
          y: this.canvas.height / 2,
          width: this.basePaddleStats.width,
          height: this.basePaddleStats.height,
          speed: this.basePaddleStats.speed
        }
      },
      score: { player1: 0, player2: 0 },
      powerups: [],
      extraBalls: [],
      activePowerUps: [],
      status: 'waiting',
      player_names: this.playerNames,
      variant: options.board_variant || 'classic',
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height
    };
    this.options = {
      max_players: options.max_players || 2,
      powerups_enabled: options.powerups_enabled || false,
      board_variant: options.board_variant || 'classic',
      gameMode: options.gameMode || 'online',
      gameType: options.gameType || '2player',
      points_to_win: options.points_to_win || 5,
      player1_name: options.player1_name,
      player2_name: options.player2_name,
      tournament_id: options.tournament_id,
      tournament_match_id: options.tournament_match_id,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height
    };
    this.gameLoop = null;
    this.powerUpSystem = new PowerUpSystem(this);
  }

  addPlayer(userId, playerNumber) {
    const playerKey = `player${playerNumber}`;
    this.players.set(userId, {
      id: userId,
      playerNumber,
      paddle: this.gameState.paddles[playerKey]
    });
  }

  addConnection(userId, socket) {
    this.connections.set(userId, socket);
    this.sendToPlayer(userId, {
      type: 'game_state',
      state: this.gameState
    });


    this.db.run('UPDATE user_presence SET status = "playing", current_game_id = ? WHERE user_id = ?', [this.gameId, userId]);

    const requiredConnections = this.options.gameMode === 'local' ? 1 : 2;
    if (this.connections.size === requiredConnections) {
      this.start();
    }
  }

  removeConnection(userId) {
    this.connections.delete(userId);
    this.db.run('UPDATE user_presence SET status = "online", current_game_id = NULL WHERE user_id = ?', [userId]);
    if (this.gameState.status === 'active' && !this.options.gameMode === 'local') {
      this.handlePlayerDisconnection(userId);
    }
  }

  handlePlayerInput(userId, input) {
    if (this.gameState.status !== 'active') return;

    if (this.options.gameMode === 'local') {
      if (input.player1_direction !== undefined) {
        this.inputStates.player1 = input.player1_direction;
      }
      if (input.player2_direction !== undefined) {
        this.inputStates.player2 = input.player2_direction;
      }
    } else {
      const player = Array.from(this.players.values()).find(p => p.id === userId);
      if (!player) {
        console.warn(`Input from unknown user: ${userId}`);
        return;
      }

      if (input.player_number !== undefined && input.player_number !== player.playerNumber) {
        console.warn(`Player number mismatch: User ${userId} attempted to control player ${input.player_number} but is player ${player.playerNumber}`);
        return;
      }
      if (player && input.direction !== undefined) {
        this.inputStates[`player${player.playerNumber}`] = input.direction;
      }
    }
  }


  updatePaddlePosition(playerKey, deltaTime) {
    const paddle = this.gameState.paddles[playerKey];
    if (!paddle) return;

    const speed = paddle.speed;
    const direction = this.inputStates[playerKey];

    if (direction === 'up' && paddle.y > paddle.height / 2) {
      paddle.y = Math.max(paddle.height / 2, paddle.y - speed * (deltaTime / 1000));
    } else if (direction === 'down' && paddle.y < this.gameState.canvasHeight - paddle.height / 2) {
      paddle.y = Math.min(this.gameState.canvasHeight - paddle.height / 2, paddle.y + speed * (deltaTime / 1000));
    }
  }

  async start() {
    this.gameState.status = 'countdown';
    for (let i = 3; i > 0; i--) {
      this.broadcast({
        type: 'countdown',
        number: i
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.gameState.status = 'active';
    this.startTime = Date.now();
    this.broadcast({ type: 'game_started' });

    this.gameLoop = setInterval(() => {
      const deltaTime = 1000 / 60;
      this.updateGameState(deltaTime);
      this.broadcast({
        type: 'game_update',
        state: this.gameState
      });
    }, 1000 / 60);
  }

  updateGameState(deltaTime) {
    if (this.gameState.status !== 'active') return;

    this.updatePaddlePosition('player1', deltaTime);
    this.updatePaddlePosition('player2', deltaTime);

    const speedFactor = deltaTime / 16.67;

    this.gameState.ball.x += this.gameState.ball.dx * speedFactor;
    this.gameState.ball.y += this.gameState.ball.dy * speedFactor;

    const ballRadius = this.gameState.canvasWidth * 0.0135; //10/800 trying with random values to make sure it doesn;t go beyond canvas???
    if (this.gameState.ball.y <= ballRadius || this.gameState.ball.y >= this.gameState.canvasHeight - ballRadius) {
      this.gameState.ball.dy = -this.gameState.ball.dy;
    }

    this.gameState.extraBalls.forEach(ball => {
      ball.x += ball.dx * speedFactor;
      ball.y += ball.dy * speedFactor;

      if (ball.y <= ballRadius || ball.y >= this.gameState.canvasHeight - ballRadius) {
        ball.dy = -ball.dy;
      }
    });

    this.checkPaddleCollisions();

    let scored = false;
    let scorerKey = null;

    if (this.gameState.ball.x < 0 || this.gameState.ball.x > this.gameState.canvasWidth) {
      scorerKey = this.gameState.ball.x < 0 ? 'player2' : 'player1';
      scored = true;
    }

    for (let i = this.gameState.extraBalls.length - 1; i >= 0; i--) {
      const ball = this.gameState.extraBalls[i];
      if (ball.x < 0 || ball.x > this.gameState.canvasWidth) {
        const ballScoredIn = ball.x < 0 ? 'player1' : 'player2';
        const potentialScorer = ball.x < 0 ? 'player2' : 'player1';

        if (!ball.owner || ball.owner !== ballScoredIn) {
          if (!scored) {
            scorerKey = potentialScorer;
            scored = true;
          }
        }
        
        this.gameState.extraBalls.splice(i, 1);
        this.broadcast({
          type: 'extra_ball_removed',
          ballId: ball.id
        });
      }
    }

    if (scored) {
      this.handleScore(scorerKey);
    }

    if (this.options.powerups_enabled) {
      this.powerUpSystem.update(deltaTime);
    }
  }

  checkPaddleCollisions() {
    const balls = [this.gameState.ball, ...this.gameState.extraBalls];
    const ballRadius = this.gameState.canvasWidth * 0.0125; // 10/800

    balls.forEach(ball => {
      for (const [playerKey, paddle] of Object.entries(this.gameState.paddles)) {
        const closestX = Math.max(paddle.x, Math.min(ball.x, paddle.x + paddle.width));
        const closestY = Math.max(paddle.y - paddle.height / 2, Math.min(ball.y, paddle.y + paddle.height / 2));
        const distanceX = ball.x - closestX;
        const distanceY = ball.y - closestY;
        const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

        if (distance < ballRadius) {
          const hitPos = (ball.y - (paddle.y - paddle.height / 2)) / paddle.height;
          const angle = (hitPos - 0.5) * Math.PI / 3;
          const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
          const direction = ball.dx > 0 ? -1 : 1;

          ball.dx = direction * speed * Math.cos(angle);
          ball.dy = speed * Math.sin(angle);
          const newSpeed = Math.min(speed * 1.05, 12);
          const angleRad = Math.atan2(ball.dy, ball.dx);
          ball.dx = Math.cos(angleRad) * newSpeed;
          ball.dy = Math.sin(angleRad) * newSpeed;
          break;
        }
      }
    });
  }

  resetPaddles() {
    for (const [key, paddle] of Object.entries(this.gameState.paddles)) {
      paddle.speed = this.basePaddleStats.speed;
      paddle.height = this.basePaddleStats.height;
      paddle.width = this.basePaddleStats.width;
      paddle.y = this.basePaddleStats.y;
    }
  }

  async handleScore(scorerKey) {
    const loserKey = scorerKey === 'player1' ? 'player2' : 'player1';

    this.gameState.score[scorerKey]++;
    this.gameState.status = 'paused';
    this.inputStates.player1 = null;
    this.inputStates.player2 = null;
    this.broadcast({ type: 'round_pause' });

    this.powerUpSystem.clearAllPowerUpsAndBalls();
    this.resetPaddles();

    if (this.gameState.score[scorerKey] >= this.options.points_to_win) {
      this.endGame(scorerKey);
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 1500));

    this.resetBall(loserKey);
    this.resetPaddles();
    this.gameState.status = 'active';
  }

  resetBall(servingPlayer = null) {
    let serveDirection;
    if (servingPlayer) {
      serveDirection = servingPlayer === 'player1' ? 1 : -1;
    } else {
      serveDirection = this.gameState.ball.dx > 0 ? 1 : -1;
    }

    const angle = (Math.random() * 30 + 15) * (Math.PI / 180);
    const initialSpeed = this.gameState.canvasWidth * 0.00625; // 5/800

    this.gameState.ball = {
      x: this.gameState.canvasWidth / 2,
      y: this.gameState.canvasHeight / 2,
      dx: serveDirection * initialSpeed * Math.cos(angle),
      dy: initialSpeed * Math.sin(angle) * (Math.random() > 0.5 ? 1 : -1)
    };
  }

  async endGame(winnerKey) {
    this.gameState.status = 'finished';
    this.endTime = Date.now();

    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }

    this.broadcast({
      type: 'game_ended',
      winner: winnerKey,
      final_score: this.gameState.score,
      is_tournament: !!this.options.tournament_id,
      tournament_id: this.options.tournament_id
    });

    await this.saveGameResults(winnerKey);

    if (this.options.tournament_id) {
      await this.handleTournamentCompletion(winnerKey);
    }
  }

  async handleTournamentCompletion(winnerKey) {
    try {
      let winnerId = null;
      if (this.options.gameMode === 'local') {
        const winnerName = winnerKey === 'player1' 
          ? this.playerNames.player1 
          : this.playerNames.player2;
        const winnerUser = await this.db.get(
          'SELECT id FROM users WHERE display_name = ? AND is_guest = TRUE',
          [winnerName]
        );
        
        if (winnerUser) {
          winnerId = winnerUser.id;
        }
      } else {
        winnerId = [...this.players.entries()]
          .find(([id, player]) => `player${player.playerNumber}` === winnerKey)?.[0];
      }

      console.log("Tournament game finished, winner ID:", winnerId, "for key:", winnerKey);

      if (this.options.tournament_match_id && winnerId) {
        await this.db.run(`
          UPDATE tournament_matches 
          SET status = 'completed', winner_id = ?, completed_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `, [winnerId, this.options.tournament_match_id]);
        const t = this.pongService.tournaments.get(this.options.tournament_id);
        if (t) {
          console.log("Game finished, checking round completion");
          await t.checkRoundCompletion();
        }
      }
    } catch (error) {
      console.error('Error handling tournament completion:', error);
    }
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
      sql = sql.slice(0, -2) + ' , updated_at = CURRENT_TIMESTAMP WHERE user_id = ?';
      params.push(userId);
      await this.db.run(sql, params);
    } else {
      // Insert
      await this.db.run('INSERT INTO user_game_stats (user_id) VALUES (?)', [userId]);
      // Then update
      await this.updateUserStats(userId, updates);
    }
  }


  async saveGameResults(winnerKey) {
    try {
      const winnerId = [...this.players.entries()]
        .find(([id, player]) => `player${player.playerNumber}` === winnerKey)?.[0];

      await this.db.run(`
        UPDATE game_sessions 
        SET status = 'completed', 
            winner_id = ?, 
            ended_at = datetime('now'),
            final_score_player1 = ?,
            final_score_player2 = ?,
            game_duration_ms = ?,
            game_settings = ?
        WHERE id = ?
      `, [
        winnerId,
        this.gameState.score.player1,
        this.gameState.score.player2,
        this.endTime - this.startTime,
        JSON.stringify(this.options),
        this.gameId
      ]);

      const participants = await this.db.all(`
        SELECT gp.user_id, gp.player_number 
        FROM game_participants gp
        WHERE gp.game_session_id = ?
      `, [this.gameId]);

      for (const participant of participants) {
        if (participant.user_id) {
          const isWin = participant.user_id === winnerId;
          const updates = {
            games_played: 1,
            games_won: isWin ? 1 : 0,
            games_lost: isWin ? 0 : 1,
          };
          
          await this.updateUserStats(participant.user_id, updates);
        }
      }

      console.log(`Game ${this.gameId} results saved`);
    } catch (error) {
      console.error('Error saving game results:', error);
    }
  }

  sendToPlayer(userId, message) {
    const connection = this.connections.get(userId);
    if (connection && connection.readyState === 1) {
      connection.send(JSON.stringify(message));
    }
  }

  broadcast(message) {
    this.connections.forEach((connection, userId) => {
      this.sendToPlayer(userId, message);
    });
  }

  handlePlayerDisconnection(userId) {
    const otherPlayers = [...this.players.keys()].filter(id => id !== userId);
    if (otherPlayers.length > 0) {
      const winnerKey = this.players.get(otherPlayers[0]).playerNumber === 1 ? 'player1' : 'player2';
      this.endGame(winnerKey);
    } else {
      this.gameState.status = 'abandoned';
      if (this.gameLoop) {
        clearInterval(this.gameLoop);
        this.gameLoop = null;
      }
    }
  }
}

module.exports = { PongGame };
