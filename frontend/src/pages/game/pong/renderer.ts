import { GameState, Paddle, Ball, PowerUp, ActivePowerUp } from './types';
import { randomNeonColor, rollNeonColor } from './utils';

let ctx: CanvasRenderingContext2D | null = null;
export let gameState: GameState = {
  paddles: {
    player1: { x: 50, y: 300, width: 20, height: 100 },
    player2: { x: 750, y: 300, width: 20, height: 100 },
  },
  ball: { x: 400, y: 300 },
  score: { player1: 0, player2: 0 },
  player_names: { player1: "Player 1", player2: "Player 2" },
  namesSet: false,
  status: "waiting",
  variant: "classic",
  powerups: [],
  extraBalls: [],
  activePowerUps: [],
  canvasWidth: 800,
  canvasHeight: 600,
  countdown: null,
};

let currentNeonColor = randomNeonColor();
let holdBallAtCenterUntil = 0;
let images: { [key: string]: HTMLImageElement } = {};
let stars: { x: number; y: number; size: number }[] = [];
let currentVariant: string | null = null;
let animationFrameId: number | null = null;

const imageUrls: { [key: string]: string } = {
  multiball: '/multiball.png',
  speed_boost: '/speed_boost.png',
  paddle_grow: '/paddle_grow.png',
  moon: '/moon.png'
};

export function initCanvas(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext("2d");
  if (!context) {
    console.error("Failed to get 2D context");
    return;
  }
  ctx = context;

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

  setupResizeHandler(canvas);
  initStars();
  startRendering(canvas);
}

function setupResizeHandler(canvas: HTMLCanvasElement): void {
  function resize() {
    canvas.width = Math.min(window.innerWidth - 40, 800);
    canvas.height = canvas.width * (gameState.canvasHeight / gameState.canvasWidth);
  }
  
  resize();
  window.addEventListener("resize", resize);
}

function initStars(): void {
  stars = [];
  for (let i = 0; i < 100; i++) {
    stars.push({
      x: Math.random() * gameState.canvasWidth,
      y: Math.random() * gameState.canvasHeight,
      size: Math.random() * 2 + 1,
    });
  }
}

function startRendering(canvas: HTMLCanvasElement): void {
  function render() {
    if (!ctx) return;

    const scaleX = canvas.width / gameState.canvasWidth;
    const scaleY = canvas.height / gameState.canvasHeight;
    const variant = gameState.variant || "classic";

    clearCanvas(ctx, canvas, variant);
    drawCourt(ctx, canvas, variant, scaleX, scaleY);
    drawPaddles(ctx, variant, scaleX, scaleY);
    drawBall(ctx, variant, scaleX, scaleY);
    drawExtraBalls(ctx, variant, scaleX, scaleY);
    drawPowerups(ctx, variant, scaleX, scaleY);
    drawActivePowerups(ctx, variant, scaleX, scaleY);
    drawScore(ctx, canvas, variant, scaleX, scaleY);
    drawCountdown(ctx, canvas, variant);

    animationFrameId = requestAnimationFrame(render);
  }

  currentNeonColor = rollNeonColor();
  animationFrameId = requestAnimationFrame(render);
}

function clearCanvas(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, variant: string): void {
  if (variant === "classic" || variant === "space" || variant === "neon") {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (variant === "space") {
    drawStars(ctx, canvas);
  }
}

function drawStars(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
  const scaleX = canvas.width / gameState.canvasWidth;
  const scaleY = canvas.height / gameState.canvasHeight;

  if (gameState.variant === "space") {
    if (currentVariant !== "space" || stars.length === 0) {
      initStars();
      currentVariant = "space";
    }
  } else {
    if (currentVariant === "space") {
      stars = [];
      currentVariant = gameState.variant;
    }
  }

  ctx.fillStyle = "white";
  stars.forEach((star) => {
    ctx.beginPath();
    ctx.arc(star.x * scaleX, star.y * scaleY, star.size * scaleX, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawCourt(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, variant: string, scaleX: number, scaleY: number): void {
  if (variant === "neon") {
    ctx.strokeStyle = currentNeonColor;
    ctx.shadowColor = currentNeonColor;
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
}

function drawPaddles(ctx: CanvasRenderingContext2D, variant: string, scaleX: number, scaleY: number): void {
  ["player1", "player2"].forEach((player) => {
    const paddle = gameState.paddles[player as keyof typeof gameState.paddles];
    if (!paddle) return;

    let fillStyle = "white";
    let shadowColor = "transparent";
    let shadowBlur = 0;

    if (variant === "neon") {
      fillStyle = currentNeonColor;
      shadowColor = currentNeonColor;
      shadowBlur = 14;
    } else if (variant === "space") {
      fillStyle = "silver";
      shadowColor = "white";
      shadowBlur = 5;
    }

    ctx.fillStyle = fillStyle;
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadowBlur;

    ctx.fillRect(
      paddle.x * scaleX,
      (paddle.y - paddle.height / 2) * scaleY,
      paddle.width * scaleX,
      paddle.height * scaleY
    );
    
    ctx.shadowBlur = 0;
  });
}

function drawBall(ctx: CanvasRenderingContext2D, variant: string, scaleX: number, scaleY: number): void {
  let drawBallX = gameState.ball?.x ?? gameState.canvasWidth / 2;
  let drawBallY = gameState.ball?.y ?? gameState.canvasHeight / 2;
  
  if (gameState.holdUntil && performance.now() < gameState.holdUntil) {
    drawBallX = gameState.canvasWidth / 2;
    drawBallY = gameState.canvasHeight / 2;
  }

  const ballRadius = gameState.canvasWidth * 0.0125;

  if (variant === "space") {
    drawMoonBall(ctx, drawBallX, drawBallY, ballRadius, scaleX, scaleY);
  } else {
    drawRegularBall(ctx, drawBallX, drawBallY, ballRadius, scaleX, scaleY, variant);
  }
}

function drawMoonBall(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, scaleX: number, scaleY: number): void {
  const moonImg = images["moon"];
  if (moonImg instanceof HTMLImageElement) {
    const moonSize = radius * 3 * scaleX;
    ctx.drawImage(
      moonImg,
      x * scaleX - moonSize / 2,
      y * scaleY - moonSize / 2,
      moonSize,
      moonSize
    );
  } else {
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(x * scaleX, y * scaleY, radius * scaleX, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRegularBall(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, scaleX: number, scaleY: number, variant: string): void {
  if (variant === "neon") {
    ctx.fillStyle = currentNeonColor;
    ctx.shadowColor = currentNeonColor;
    ctx.shadowBlur = 20;
  } else {
    ctx.fillStyle = "white";
    ctx.shadowBlur = 0;
  }
  
  ctx.beginPath();
  ctx.arc(x * scaleX, y * scaleY, radius * scaleX, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawExtraBalls(ctx: CanvasRenderingContext2D, variant: string, scaleX: number, scaleY: number): void {
  const ballRadius = gameState.canvasWidth * 0.0125;
  
  gameState.extraBalls.forEach((ball: Ball) => {
    ctx.fillStyle = variant === 'neon' ? currentNeonColor : 'orange';
    ctx.shadowColor = variant === 'neon' ? currentNeonColor : 'yellow';
    ctx.shadowBlur = variant === 'neon' ? 15 : 8;
    
    ctx.beginPath();
    ctx.arc(ball.x * scaleX, ball.y * scaleY, (ballRadius * 0.8) * scaleX, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowBlur = 0;
  });
}

function drawPowerups(ctx: CanvasRenderingContext2D, variant: string, scaleX: number, scaleY: number): void {
  gameState.powerups.forEach((powerup: PowerUp) => {
    if (images[powerup.type] && images[powerup.type].complete) {
      ctx.shadowBlur = variant === 'neon' ? 12 : 0;
      ctx.shadowColor = variant === 'neon' ? currentNeonColor : 'transparent';
      ctx.drawImage(
        images[powerup.type],
        powerup.x * scaleX,
        powerup.y * scaleY,
        powerup.width * scaleX,
        powerup.height * scaleY
      );
      ctx.shadowBlur = 0;
    } else {
      const color = currentNeonColor;
      ctx.fillStyle = color;
      ctx.shadowBlur = variant === 'neon' ? 12 : 0;
      ctx.shadowColor = variant === 'neon' ? color : 'transparent';
      ctx.fillRect(
        powerup.x * scaleX,
        powerup.y * scaleY,
        powerup.width * scaleX,
        powerup.height * scaleY
      );
      ctx.shadowBlur = 0;
    }
  });
}

function drawActivePowerups(ctx: CanvasRenderingContext2D, variant: string, scaleX: number, scaleY: number): void {
  gameState.activePowerUps.forEach((powerup: ActivePowerUp) => {
    const paddle = gameState.paddles[powerup.playerId as keyof typeof gameState.paddles];
    if (!paddle) return;

    const iconSize = gameState.canvasWidth * 0.05;
    const iconX = powerup.playerId === 'player1' 
      ? (paddle.x + paddle.width + iconSize * 0.6667) 
      : (paddle.x - iconSize * 1.3333);
    const iconY = paddle.y;
    
    const remaining = powerup.type === 'multiball' 
      ? 1 
      : (powerup.endTime - Date.now()) / powerup.duration;
    
    ctx.globalAlpha = Math.max(0, Math.min(1, remaining));

    if (images[powerup.type] && images[powerup.type].complete) {
      ctx.drawImage(
        images[powerup.type],
        iconX * scaleX,
        (iconY - iconSize / 2) * scaleY,
        iconSize * scaleX,
        iconSize * scaleY
      );
    } else {
      const color = currentNeonColor;
      ctx.fillStyle = color;
      ctx.fillRect(
        iconX * scaleX,
        (iconY - iconSize / 2) * scaleY,
        iconSize * scaleX,
        iconSize * scaleY
      );
    }

    ctx.globalAlpha = 1;
  });
}

function drawScore(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, variant: string, scaleX: number, scaleY: number): void {
  const scoreColor = variant === "neon" ? currentNeonColor : "white";
  ctx.fillStyle = scoreColor;
  ctx.font = `${gameState.canvasWidth * 0.055}px Arial Black`;
  ctx.textAlign = "center";
  
  ctx.fillText(
    `${gameState.score?.player1 ?? 0}`,
    canvas.width / 2 - (gameState.canvasWidth * 0.075) * scaleX,
    (gameState.canvasHeight * 0.1167) * scaleY
  );
  
  ctx.fillText(
    `${gameState.score?.player2 ?? 0}`,
    canvas.width / 2 + (gameState.canvasWidth * 0.075) * scaleX,
    (gameState.canvasHeight * 0.1167) * scaleY
  );
}

function drawCountdown(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, variant: string): void {
  if (gameState.countdown !== null) {
    const cdColor = variant === "neon" ? currentNeonColor : "white";
    ctx.fillStyle = cdColor;
    ctx.shadowColor = cdColor;
    ctx.shadowBlur = variant === "neon" ? 18 : 0;
    ctx.font = `${gameState.canvasWidth * 0.1125}px Arial Black`;
    ctx.textAlign = "center";
    ctx.fillText(`${gameState.countdown}`, canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 0;
  }
}

export function updateScene(state: Partial<GameState>): void {
  if (!state) {
    console.warn("Received empty state in updateScene");
    return;
  }
  
  gameState = {
    ...gameState,
    ...state,
    paddles: {
      player1: state.paddles?.player1 || gameState.paddles.player1,
      player2: state.paddles?.player2 || gameState.paddles.player2,
    },
    ball: state.ball || gameState.ball,
    score: state.score || gameState.score,
    player_names: state.player_names || gameState.player_names,
    powerups: state.powerups || gameState.powerups,
    extraBalls: state.extraBalls || gameState.extraBalls,
    activePowerUps: state.activePowerUps || gameState.activePowerUps,
    countdown: state.countdown !== undefined ? state.countdown : gameState.countdown,
  };

  if (!gameState.namesSet && gameState.player_names) {
    const currentUserDisplayName = localStorage.getItem("display_name") || gameState.player_names.player1 || "Player 1";
    const opponentAlias = gameState.player_names.player2 || "Player 2";
    
    const player1NameEl = document.getElementById("player1-name");
    const player2NameEl = document.getElementById("player2-name");
    
    if (player1NameEl) player1NameEl.textContent = currentUserDisplayName;
    if (player2NameEl) player2NameEl.textContent = opponentAlias;
    
    console.log(`Set player names: ${currentUserDisplayName} vs ${opponentAlias}`);
    gameState.namesSet = true;
  }
}

export function cleanupRenderer(): void {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
}
