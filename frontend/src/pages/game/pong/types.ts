export interface GameState {
  paddles: {
    player1: Paddle;
    player2: Paddle;
  };
  ball: Ball;
  score: {
    player1: number;
    player2: number;
  };
  player_names: {
    player1: string;
    player2: string;
  };
  namesSet: boolean,
  status: string;
  variant: string;
  powerups: PowerUp[];
  extraBalls: Ball[];
  activePowerUps: ActivePowerUp[];
  canvasWidth: number;
  canvasHeight: number;
  countdown?: number | null;
  holdUntil?: number;
}

export interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Ball {
  x: number;
  y: number;
  id?: string;
}

export interface PowerUp {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ActivePowerUp {
  id: string;
  type: string;
  playerId: string;
  endTime: number;
  duration: number;
}

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}
