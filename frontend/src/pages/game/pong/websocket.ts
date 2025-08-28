import { GameState } from './types';
import { updateScene } from './renderer';
import { rollNeonColor } from './utils';

let isLocalMultiplayer = false;
let holdBallAtCenterUntil = 0;
let countdownNumber: number | null = null;

export function createWebSocketHandler(
  gameId: string, 
  token: string | null,
  onGameEnd: (winner: string) => void
): WebSocket {
  const ws = new WebSocket(`wss://${window.location.host}/api/pong/wss?game_id=${gameId}`);

  ws.onopen = () => {
    console.log("Connected to Pong WS");
    ws.send(JSON.stringify({ type: "auth", token }));
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data, onGameEnd);
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

  return ws;
}

function handleWebSocketMessage(data: any, onGameEnd: (winner: string) => void): void {
  switch (data.type) {
    case "auth_success":
      isLocalMultiplayer = data.player_id === "both";
      console.log(`Authenticated as ${data.player_id}`);
      break;

    case "game_state":
    case "game_update":
      updateScene(data.state);
      break;

    case "countdown":
      console.log("Received countdown:", data.number)
      updateScene({ 
        ...data.state,
        countdown: data.number 
      });
      break;

    case "round_pause":
      updateScene({ holdUntil: performance.now() + 1500 });
      rollNeonColor();
      break;

    case "game_started":
      rollNeonColor();
      updateScene({ countdown: null });
      console.log("Game started");
      break;

    case "game_ended":
      onGameEnd(data.winner);
      break;

    case "powerup_spawned":
      break;

    case "powerup_collected":
      break;

    case "extra_ball_spawned":
      break;

    case "extra_ball_removed":
      break;

    case "all_extra_balls_cleared":
      break;

    case "powerup_ended":
      break;

    case "paddle_speed_changed":
    case "paddle_size_changed":
      updateScene(data.state || {});
      break;

    case "powerup_expired":
      break;

    case "all_powerups_cleared":
      break;

    default:
      console.warn("Unknown message type:", data.type);
  }
}

export function sendPaddleMove(ws: WebSocket, player1Input: string | null, player2Input: string | null): void {
  if (!isLocalMultiplayer) return;

  const message = {
    type: "paddle_move",
    player1: player1Input ? { direction: player1Input } : null,
    player2: player2Input ? { direction: player2Input } : null,
  };
  ws.send(JSON.stringify(message));
}
