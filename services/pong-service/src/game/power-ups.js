class PowerUpSystem {
  constructor(game) {
    this.game = game;
    this.activePowerUps = this.game.gameState.activePowerUps || [];
    this.extraBalls = this.game.gameState.extraBalls || [];
    this.multiballOwner = null;
    this.playerPowerUps = { player1: null, player2: null };
    this.powerUpTypes = {
      multiball: {
        duration: Infinity,
        apply: (playerId, position) => this.spawnExtraBalls(playerId, position),
        remove: (ballIds) => {
          if (Array.isArray(ballIds)) {
            ballIds.forEach(id => this.removeExtraBall(id));
          } else {
            this.removeExtraBall(ballIds);
          }
        },
        rarity: 0.1
      },
      speed_boost: {
        duration: 8000,
        apply: (playerId) => this.boostPaddleSpeed(playerId, 2),
        remove: (playerId) => this.boostPaddleSpeed(playerId, 0.5),
        rarity: 0.4
      },
      paddle_grow: {
        duration: 7000,
        apply: (playerId) => this.resizePaddle(playerId, 2),
        remove: (playerId) => this.resizePaddle(playerId, 1 / 1.5),
        rarity: 0.5
      }
    };
  }

  spawnPowerUp() {
    if (!this.game.options.powerups_enabled) {
      return;
    }
    if (this.game.gameState.score.player1 === 0 && this.game.gameState.score.player2 === 0) {
      return;
    }
    if (this.game.gameState.powerups.length >= 5) {
      return;
    }
    if (Math.random() > 0.005) {
      return;
    }

    const types = Object.keys(this.powerUpTypes);
    const totalRarity = types.reduce((sum, type) => sum + this.powerUpTypes[type].rarity, 0);
    let random = Math.random() * totalRarity;
    let selectedType;
    for (const type of types) {
      random -= this.powerUpTypes[type].rarity;
      if (random <= 0) {
        selectedType = type;
        break;
      }
    }

    const margin = Math.min(this.game.gameState.canvasWidth, this.game.gameState.canvasHeight) * 0.20; // 12.5% margin
    const powerUpSize = this.game.gameState.canvasWidth * 0.0625; // 50/800 = 0.0625

    const powerUp = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      type: selectedType,
      x: Math.random() * (this.game.gameState.canvasWidth - 2 * margin) + margin,
      y: Math.random() * (this.game.gameState.canvasHeight - 2 * margin) + margin,
      width: powerUpSize,
      height: powerUpSize,
      spawnTime: Date.now()
    };

    this.game.gameState.powerups.push(powerUp);

    this.game.broadcast({
      type: 'powerup_spawned',
      powerUp
    });

    setTimeout(() => {
      const index = this.game.gameState.powerups.findIndex(p => p.id === powerUp.id);
      if (index !== -1) {
        this.game.gameState.powerups.splice(index, 1);
        this.game.broadcast({
          type: 'powerup_expired',
          powerUpId: powerUp.id
        });
      }
    }, 5000);
  }

  checkPowerUpCollisions() {
    const ball = this.game.gameState.ball;
    const ballRadius = this.game.gameState.canvasWidth * 0.0125; // 10/800 = 0.0125

    for (let i = this.game.gameState.powerups.length - 1; i >= 0; i--) {
      const p = this.game.gameState.powerups[i];

      if (ball.x < p.x + p.width &&
          ball.x + 2 * ballRadius > p.x &&
          ball.y < p.y + p.height &&
          ball.y + 2 * ballRadius > p.y) {
        const playerKey = ball.dx > 0 ? 'player1' : 'player2';
        
        if (this.playerPowerUps[playerKey]) {
          continue;
        }

        this.activatePowerUp(playerKey, p.type, { x: p.x, y: p.y });

        this.game.gameState.powerups.splice(i, 1);

        this.game.broadcast({
          type: 'powerup_collected',
          powerUpId: p.id,
          playerId: playerKey
        });
      }
    }
  }

  getLastToucher() {
    const ball = this.game.gameState.ball;
    const paddles = this.game.gameState.paddles;
    
    if (ball.dx > 0 && ball.x < paddles.player1.x + paddles.player1.width) {
      return 'player1';
    } else if (ball.dx < 0 && ball.x > paddles.player2.x) {
      return 'player2';
    }
    return null;
  }

  activatePowerUp(playerKey, powerUpType, position) {
    const powerUp = this.powerUpTypes[powerUpType];
    if (!powerUp) {
      console.error(`Invalid power-up type: ${powerUpType}`);
      return;
    }

    this.playerPowerUps[playerKey] = powerUpType;

    if (powerUpType === 'multiball') {
      this.multiballOwner = playerKey;
    }

    const effectId = powerUp.apply(playerKey, position);

    const powerUpInstance = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      type: powerUpType,
      playerId: playerKey,
      startTime: Date.now(),
      endTime: powerUpType === 'multiball' ? Infinity : Date.now() + powerUp.duration,
      duration: powerUp.duration,
      effectId
    };

    this.activePowerUps.push(powerUpInstance);

    this.game.gameState.activePowerUps = this.activePowerUps;

    this.game.broadcast({
      type: 'powerup_activated',
      powerUp: powerUpInstance
    });

    if (powerUpType !== 'multiball') {
      setTimeout(() => {
        this.deactivatePowerUp(powerUpInstance);
      }, powerUp.duration);
    }
  }

  deactivatePowerUp(powerUp) {
    const index = this.activePowerUps.findIndex(p => p.id === powerUp.id);
    if (index === -1) {
      console.warn(`PowerUp ${powerUp.id} not found in activePowerUps`);
      return;
    }

    this.activePowerUps.splice(index, 1);

    this.game.gameState.activePowerUps = this.activePowerUps;

    this.playerPowerUps[powerUp.playerId] = null;

    if (powerUp.type === 'multiball') {
      const ballIds = [...this.extraBalls.map(b => b.id)];
      ballIds.forEach(id => this.removeExtraBall(id));
      this.multiballOwner = null;
    } else {
      this.powerUpTypes[powerUp.type].remove(powerUp.playerId);
    }

    this.game.broadcast({
      type: 'powerup_ended',
      powerUpId: powerUp.id
    });
  }

  clearAllPowerUpsAndBalls() {
    this.game.gameState.powerups = [];
    this.game.broadcast({
      type: 'all_powerups_cleared'
    });

    this.extraBalls = [];
    this.game.gameState.extraBalls = [];
    this.multiballOwner = null;
    this.playerPowerUps = { player1: null, player2: null };

    this.game.broadcast({
      type: 'all_extra_balls_cleared'
    });

    for (const powerUp of [...this.activePowerUps]) {
      this.deactivatePowerUp(powerUp);
    }
  }

  update(deltaTime) {
    this.spawnPowerUp();
    this.checkPowerUpCollisions();

    const now = Date.now();
    const activePowerUpsCopy = [...this.activePowerUps];
      
    for (const powerUp of activePowerUpsCopy) {
      if (powerUp.type !== 'multiball' && now >= powerUp.endTime) {
        console.log(`PowerUp ${powerUp.type} expired for ${powerUp.playerId}`);
        this.deactivatePowerUp(powerUp);
      }
    }

    const speedFactor = deltaTime / 16.67;
    const ballRadius = this.game.gameState.canvasWidth * 0.0125; // 10/800

    for (const ball of this.extraBalls) {
      ball.x += ball.dx * speedFactor;
      ball.y += ball.dy * speedFactor;

      if (ball.y <= ballRadius || ball.y >= this.game.gameState.canvasHeight - ballRadius) {
        ball.dy = -ball.dy;
      }
      for (const [playerKey, paddle] of Object.entries(this.game.gameState.paddles)) {
        const closestX = Math.max(paddle.x, Math.min(ball.x, paddle.x + paddle.width));
        const closestY = Math.max(paddle.y - paddle.height / 2, Math.min(ball.y, paddle.y + paddle.height / 2));
        const distanceX = ball.x - closestX;
        const distanceY = ball.y - closestY;
        const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
        const ballRadius = this.game.gameState.canvasWidth * 0.0125; // 10/800

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

      if (ball.x < 0 || ball.x > this.game.gameState.canvasWidth) {
        this.handleExtraBallScore(ball);
      }
    }
  }

  spawnExtraBalls(playerId, position) {
    const baseX = position?.x ?? this.game.gameState.canvasWidth / 2;
    const baseY = position?.y ?? this.game.gameState.canvasHeight / 2;

    const mainBall = this.game.gameState.ball;
    const speed = Math.sqrt(mainBall.dx * mainBall.dx + mainBall.dy * mainBall.dy);
    const angle = Math.atan2(mainBall.dy, mainBall.dx);
    const angleOffset = Math.PI / 12; // 15 degrees

    const ball1Id = Date.now().toString(36) + '1';
    const ball1 = {
      id: ball1Id,
      x: baseX,
      y: baseY,
      dx: Math.cos(angle + angleOffset) * speed,
      dy: Math.sin(angle + angleOffset) * speed,
      owner: playerId
    };

    const ball2Id = Date.now().toString(36) + '2';
    const ball2 = {
      id: ball2Id,
      x: baseX,
      y: baseY,
      dx: Math.cos(angle - angleOffset) * speed,
      dy: Math.sin(angle - angleOffset) * speed,
      owner: playerId
    };

    this.extraBalls.push(ball1, ball2);
    this.game.gameState.extraBalls.push(ball1, ball2);

    this.game.broadcast({
      type: 'extra_ball_spawned',
      ball: ball1
    });
    this.game.broadcast({
      type: 'extra_ball_spawned',
      ball: ball2
    });

    return [ball1Id, ball2Id];
  }

  removeExtraBall(ballId) {
    const index = this.extraBalls.findIndex(b => b.id === ballId);
    if (index !== -1) {
      this.extraBalls.splice(index, 1);
      this.game.gameState.extraBalls = this.extraBalls;
      this.game.broadcast({
        type: 'extra_ball_removed',
        ballId
      });
    }
  }

  boostPaddleSpeed(playerKey, factor) {
    const paddle = this.game.gameState.paddles[playerKey];
    if (paddle) {
      paddle.speed *= factor;
      this.game.broadcast({
        type: 'paddle_speed_changed',
        playerId: playerKey,
        state: this.game.gameState
      });
    }
  }

  resizePaddle(playerKey, factor) {
    const paddle = this.game.gameState.paddles[playerKey];
    if (paddle) {
      paddle.height *= factor;
      this.game.broadcast({
        type: 'paddle_size_changed',
        playerId: playerKey,
        state: this.game.gameState
      });
    }
  }

  handleExtraBallScore(ball) {
    const scoringSide = ball.x < 0 ? 'player2' : 'player1';
    if (ball.owner && ball.owner !== scoringSide) {
      this.game.handleScore(scoringSide);
    }
    this.removeExtraBall(ball.id);
  }
}

module.exports = { PowerUpSystem };
