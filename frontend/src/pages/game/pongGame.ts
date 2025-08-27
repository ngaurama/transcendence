export async function pongGamePage(): Promise<string> {
  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get("game_id");
  if (!gameId) return "<h2>Error: No game ID</h2>";

  return `
    <div class="max-w-4xl mx-auto px-2">
      <h2 class="text-2xl mb-4 text-center">Pong Game #${gameId}</h2>
      <div id="player-info" class="text-center mb-2">
        <p>Player 1: Use W/S keys | Player 2: Use Arrow Up/Down keys</p>
      </div>
      <div class="relative">
        <canvas id="game-canvas" class="game-canvas border border-gray-500 mx-auto block"></canvas>
        <div id="countdown-overlay" class="hidden absolute inset-0 flex items-center justify-center text-white text-6xl"></div>
      </div>
      <div id="player-names" class="mt-3 flex justify-between text-lg">
        <div id="player1-name" class="text-left"></div>
        <div id="player2-name" class="text-right"></div>
      </div>
      <div id="game-end" class="hidden text-center mt-4">
        <h3 id="winner-text" class="text-2xl mb-4"></h3>
        <button id="rematch" class="bg-blue-500 text-white p-2 rounded mr-2">Rematch</button>
        <button id="play-again" class="bg-green-500 text-white p-2 rounded">Play Again</button>
      </div>
    </div>
  `;
}

export function attachPongGameListeners() {
  const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
  if (canvas) initCanvas(canvas);

  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get("game_id");
  const token = localStorage.getItem("access_token");

  const ws = new WebSocket(`wss://${window.location.host}/api/pong/wss?game_id=${gameId}`);

  let isLocalMultiplayer = false;

  ws.onopen = () => {
    console.log("Connected to Pong WS");
    ws.send(
      JSON.stringify({
        type: "auth",
        token: token,
      })
    );
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "auth_success") {
        isLocalMultiplayer = data.player_id === "both";
        console.log(`Authenticated as ${data.player_id}`);
      } else if (data.type === "game_state" || data.type === "game_update") {
        updateScene(data.state);
      } else if (data.type === "countdown") {
        countdownNumber = data.number;
      } else if (data.type === "round_pause") {
        rollNeonColor();
        holdBallAtCenterUntil = performance.now() + 1500;
      } else if (data.type === "game_started") {
        rollNeonColor();
        countdownNumber = null;
        console.log("Game started");
      } else if (data.type === "game_ended") {
        document.getElementById("game-end")?.classList.remove("hidden");
        const winnerName =
          data.winner === "player1"
            ? (gameState.player_names?.player1 ?? "Player 1")
            : (gameState.player_names?.player2 ?? "Player 2");
        document.getElementById("winner-text")!.textContent = `Winner: ${winnerName}`;
      } else if (data.type === "powerup_spawned") {
        gameState.powerups = [...gameState.powerups, data.powerUp];
      } else if (data.type === "powerup_collected") {
        gameState.powerups = gameState.powerups.filter((p: any) => p.id !== data.powerUpId);
      } else if (data.type === "extra_ball_spawned") {
        gameState.extraBalls = [...gameState.extraBalls, data.ball];
      } else if (data.type === "extra_ball_removed") {
        gameState.extraBalls = gameState.extraBalls.filter((b: any) => b.id !== data.ballId);
      } else if (data.type === "all_extra_balls_cleared") {
        gameState.extraBalls = [];
      } else if (data.type === "powerup_ended") {
        gameState.activePowerUps = gameState.activePowerUps.filter((p: any) => p.id !== data.powerUpId);
      } else if (data.type === "paddle_speed_changed" || data.type === "paddle_size_changed") {
        updateScene(data.state || {});
      } else if (data.type === "powerup_expired") {
        gameState.powerups = gameState.powerups.filter((p: any) => p.id !== data.powerUpId);
      } else if (data.type === "all_powerups_cleared") {
        gameState.powerups = [];
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  ws.onclose = (event) => {
    console.log("WebSocket closed:", event.code, event.reason);
    (window as any).navigate("/play");
  };

  let player1Input: string | null = null;
  let player2Input: string | null = null;

  document.addEventListener("keydown", (event) => {
    if (!isLocalMultiplayer) return;

    if (event.key === "w" || event.key === "W") {
      player1Input = "up";
    } else if (event.key === "s" || event.key === "S") {
      player1Input = "down";
    }

    if (event.key === "ArrowUp") {
      player2Input = "up";
    } else if (event.key === "ArrowDown") {
      player2Input = "down";
    }

    if (player1Input || player2Input) {
      const message = {
        type: "paddle_move",
        player1: player1Input ? { direction: player1Input } : null,
        player2: player2Input ? { direction: player2Input } : null,
      };
      ws.send(JSON.stringify(message));
    }
  });

  document.addEventListener("keyup", (event) => {
    if (!isLocalMultiplayer) return;

    if (event.key === "w" || event.key === "s" || event.key === "W" || event.key === "S") {
      player1Input = "stop";
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      player2Input = "stop";
    }

    const message = {
      type: "paddle_move",
      player1: player1Input ? { direction: player1Input } : null,
      player2: player2Input ? { direction: player2Input } : null,
    };
    ws.send(JSON.stringify(message));
  });

  const rematchBtn = document.getElementById("rematch");
  if (rematchBtn) {
    rematchBtn.addEventListener("click", async () => {
      const opt = (window as any).gameOptions;
      if (opt && opt.mode === "local") {
        try {
          const token = localStorage.getItem("access_token");
          const res = await fetch(`/api/pong/game/create`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              is_private: true,
              max_players: 2,
              power_ups_enabled: opt.powerups,
              map_variant: opt.variant,
              points_to_win: opt.points,
              opponent_alias: opt.opponent_alias,
              canvasWidth: opt.canvasWidth || 800,
              canvasHeight: opt.canvasHeight || 600
            }),
          });
          if (!res.ok) throw new Error("Failed to create rematch");
          const data = await res.json();
          if (data.success) {
            console.log(`Rematch created: game_id=${data.game_id}`);
            (window as any).navigate(`/game/pong?game_id=${data.game_id}`);
          }
        } catch (error) {
          console.error("Rematch failed:", error);
        }
      }
    });
  }

  const playAgainBtn = document.getElementById("play-again");
  if (playAgainBtn) {
    playAgainBtn.addEventListener("click", () => {
      console.log("Navigating to play page");
      (window as any).navigate("/play");
    });
  }
}

let ctx: CanvasRenderingContext2D | null = null;
let gameState: any = {
  paddles: {
    player1: { x: 50, y: 300, width: 20, height: 100 },
    player2: { x: 750, y: 300, width: 20, height: 100 },
  },
  ball: { x: 400, y: 300 },
  score: { player1: 0, player2: 0 },
  player_names: { player1: "Player 1", player2: "Player 2" },
  status: "waiting",
  variant: "classic",
  powerups: [],
  extraBalls: [],
  activePowerUps: [],
  canvasWidth: 800,
  canvasHeight: 600
};
let namesSet = false;
let countdownNumber: number | null = null;
let neonColor = randomNeonColor();
let holdBallAtCenterUntil = 0;
let images: { [key: string]: HTMLImageElement } = {};

function initCanvas(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) {
    console.error("Failed to get 2D context");
    return;
  }
  ctx = context;

  const imageUrls: { [key: string]: string } = {
    multiball: '/multiball.png',
    speed_boost: '/speed_boost.png',
    paddle_grow: '/paddle_grow.png',
    moon: '/moon.png'
  };

  for (const [type, url] of Object.entries(imageUrls)) {
    const img = new Image();
    img.src = url;
    img.onload = () => {
      images[type] = img;
      console.log(`Loaded image for ${type}`);
    };
    img.onerror = () => {
      console.error(`Failed to load image for ${type}: ${url}`);
    };
  }

  function resize() {
    canvas.width = Math.min(window.innerWidth - 40, 800);
    canvas.height = canvas.width * (gameState.canvasHeight / gameState.canvasWidth);
  }
  resize();
  window.addEventListener("resize", resize);

  let stars: { x: number; y: number; size: number }[] = [];
  let currentVariant: string | null = null;
  function initStars() {
    stars = [];
    for (let i = 0; i < 100; i++) {
      stars.push({
        x: Math.random() * gameState.canvasWidth,
        y: Math.random() * gameState.canvasHeight,
        size: Math.random() * 2 + 1,
      });
    }
  }

  if (gameState.variant === "space") initStars();

  function render() {
    if (!ctx) return;

    const scaleX = canvas.width / gameState.canvasWidth;
    const scaleY = canvas.height / gameState.canvasHeight;

    const variant = gameState.variant || "classic";

    if (variant === "space") {
      if (currentVariant !== "space" || stars.length === 0) {
        initStars();
        currentVariant = "space";
      }
    } else {
      if (currentVariant === "space") {
        stars = [];
        currentVariant = variant;
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (variant === "classic" || variant === "space" || variant === "neon") {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (variant === "space") {
      ctx.fillStyle = "white";
      stars.forEach((star) => {
        ctx.beginPath();
        ctx.arc(star.x * scaleX, star.y * scaleY, star.size * scaleX, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    if (variant === "neon") {
      ctx.strokeStyle = neonColor;
      ctx.shadowColor = neonColor;
      ctx.shadowBlur = 16;
    } else {
      ctx.strokeStyle = "white";
      ctx.shadowBlur = 0;
    }
    ctx.lineWidth = 2 * scaleX;
    ctx.setLineDash([6 * scaleY, 16 * scaleY]);
    ctx.beginPath();
    ctx.moveTo((gameState.canvasWidth / 2) * scaleX, 0);
    ctx.lineTo((gameState.canvasWidth / 2) * scaleX, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    ["player1", "player2"].forEach((player) => {
      const paddle = gameState.paddles[player];
      if (!paddle) return;

      if (variant === "neon") {
        ctx.fillStyle = neonColor;
        ctx.shadowColor = neonColor;
        ctx.shadowBlur = 14;
      } else if (variant === "space") {
        ctx.fillStyle = "silver";
        ctx.shadowColor = "white";
        ctx.shadowBlur = 5;
      } else {
        ctx.fillStyle = "white";
        ctx.shadowBlur = 0;
      }

      ctx.fillRect(
        paddle.x * scaleX,
        (paddle.y - paddle.height / 2) * scaleY,
        paddle.width * scaleX,
        paddle.height * scaleY
      );
      ctx.shadowBlur = 0;
    });

    let drawBallX = gameState.ball?.x ?? gameState.canvasWidth / 2;
    let drawBallY = gameState.ball?.y ?? gameState.canvasHeight / 2;
    if (performance.now() < holdBallAtCenterUntil) {
      drawBallX = gameState.canvasWidth / 2;
      drawBallY = gameState.canvasHeight / 2;
    }

    const ballRadius = gameState.canvasWidth * 0.0125; // 10/800
    if (variant === "space") {
      const moonImg = images["moon"];
      if (moonImg instanceof HTMLImageElement) {
        const moonSize = ballRadius * 3 * scaleX;
        ctx.drawImage(
          moonImg,
          drawBallX * scaleX - moonSize / 2,
          drawBallY * scaleY - moonSize / 2,
          moonSize,
          moonSize
        );
      } else {
        // Fallback: draw a simple ball until the image loads
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(drawBallX * scaleX, drawBallY * scaleY, ballRadius * scaleX, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
       if (variant === "neon") {
        ctx.fillStyle = neonColor;
        ctx.shadowColor = neonColor;
        ctx.shadowBlur = 20;
      } else {
        ctx.fillStyle = "white";
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.arc(drawBallX * scaleX, drawBallY * scaleY, ballRadius * scaleX, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    (gameState.extraBalls || []).forEach((ball: any) => {
      ctx!.fillStyle = variant === 'neon' ? neonColor : 'orange';
      ctx!.shadowColor = variant === 'neon' ? neonColor : 'yellow';
      ctx!.shadowBlur = variant === 'neon' ? 15 : 8;
      ctx!.beginPath();
      ctx!.arc(ball.x * scaleX, ball.y * scaleY, (ballRadius * 0.8) * scaleX, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.shadowBlur = 0;
    });

    (gameState.powerups || []).forEach((p: any) => {
      if (images[p.type] && images[p.type].complete) {
        ctx!.shadowBlur = variant === 'neon' ? 12 : 0;
        ctx!.shadowColor = variant === 'neon' ? neonColor : 'transparent';
        ctx!.drawImage(images[p.type], p.x * scaleX, p.y * scaleY, p.width * scaleX, p.height * scaleY);
        ctx!.shadowBlur = 0;
      } else {
        const color = neonColor;
        ctx!.fillStyle = color;
        ctx!.shadowBlur = variant === 'neon' ? 12 : 0;
        ctx!.shadowColor = variant === 'neon' ? color : 'transparent';
        ctx!.fillRect(p.x * scaleX, p.y * scaleY, p.width * scaleX, p.height * scaleY);
        ctx!.shadowBlur = 0;
      }
    });

    (gameState.activePowerUps || []).forEach((ap: any) => {
      const paddle = gameState.paddles[ap.playerId];
      if (!paddle) return;

      const iconSize = gameState.canvasWidth * 0.05; // 30/800
      const iconX = ap.playerId === 'player1' ? (paddle.x + paddle.width + iconSize * 0.6667) : (paddle.x - iconSize * 1.3333);
      const iconY = paddle.y;
      const remaining = ap.type === 'multiball' ? 1 : (ap.endTime - Date.now()) / ap.duration;
      ctx!.globalAlpha = Math.max(0, Math.min(1, remaining));

      (`Rendering active power-up: ${JSON.stringify(ap)}`);
      if (images[ap.type] && images[ap.type].complete) {
        ctx!.drawImage(images[ap.type], iconX * scaleX, (iconY - iconSize / 2) * scaleY, iconSize * scaleX, iconSize * scaleY);
      } else {
        const color = neonColor;
        ctx!.fillStyle = color;
        ctx!.fillRect(iconX * scaleX, (iconY - iconSize / 2) * scaleY, iconSize * scaleX, iconSize * scaleY);
      }

      ctx!.globalAlpha = 1;
    });

    const scoreColor = variant === "neon" ? neonColor : "white";
    ctx.fillStyle = scoreColor;
    ctx.font = `${gameState.canvasWidth * 0.055}px Arial Black`; // 44/800
    ctx.textAlign = "center";
    ctx.fillText(`${gameState.score?.player1 ?? 0}`, canvas.width / 2 - (gameState.canvasWidth * 0.075) * scaleX, (gameState.canvasHeight * 0.1167) * scaleY);
    ctx.fillText(`${gameState.score?.player2 ?? 0}`, canvas.width / 2 + (gameState.canvasWidth * 0.075) * scaleX, (gameState.canvasHeight * 0.1167) * scaleY);

    if (countdownNumber !== null) {
      const cdColor = variant === "neon" ? neonColor : "white";
      ctx.fillStyle = cdColor;
      ctx.shadowColor = cdColor;
      ctx.shadowBlur = variant === "neon" ? 18 : 0;
      ctx.font = `${gameState.canvasWidth * 0.1125}px Arial Black`; // 90/800
      ctx.textAlign = "center";
      ctx.fillText(`${countdownNumber}`, canvas.width / 2, canvas.height / 2);
      ctx.shadowBlur = 0;
    }

    requestAnimationFrame(render);
  }

  rollNeonColor();
  requestAnimationFrame(render);
}

function updateScene(state: any) {
  if (!state) {
    console.warn("Received empty state in updateScene");
    return;
  }
  
  gameState = {
    paddles: {
      player1: state.paddles?.player1 || gameState.paddles.player1,
      player2: state.paddles?.player2 || gameState.paddles.player2,
    },
    ball: state.ball || gameState.ball,
    score: state.score || gameState.score,
    player_names: state.player_names || gameState.player_names,
    status: state.status || gameState.status,
    variant: state.variant || gameState.variant,
    powerups: state.powerups || gameState.powerups || [],
    extraBalls: state.extraBalls || gameState.extraBalls || [],
    activePowerUps: state.activePowerUps || gameState.activePowerUps || [],
    canvasWidth: state.canvasWidth || gameState.canvasWidth,
    canvasHeight: state.canvasHeight || gameState.canvasHeight
  };

  if (!namesSet && gameState.player_names) {
    const currentUserDisplayName = localStorage.getItem("display_name") || gameState.player_names.player1 || "Player 1";
    const opponentAlias = gameState.player_names.player2 || "Player 2";
    document.getElementById("player1-name")!.textContent = currentUserDisplayName;
    document.getElementById("player2-name")!.textContent = opponentAlias;
    console.log(`Set player names: ${currentUserDisplayName} vs ${opponentAlias}`);
    namesSet = true;
  }
}

function randomNeonColor(): string {
  const hue = Math.floor(Math.random() * 360);
  const light = 60;
  return `hsl(${hue}, 100%, ${light}%)`;
}

function rollNeonColor() {
  neonColor = randomNeonColor();
}
