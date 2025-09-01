// pages/websocket.ts
import { GameState } from './types';
import { updateScene } from './renderer';
import { rollNeonColor } from './utils';

export function createWebSocketHandler(
  gameId: string,
  token: string | null,
  onGameEnd: (winner: string) => void
): WebSocket {

  const ws = new WebSocket(`wss://${window.location.host}/api/pong/wss?game_id=${gameId}`);

  ws.onopen = () => {
    console.log('WebSocket connected successfully');
    ws.send(JSON.stringify({ type: 'auth', token }));
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data, onGameEnd);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = (event) => {
    console.log('WebSocket closed:', event.code, event.reason);
    (window as any).navigate('/');
  };

  return ws;
}

function handleWebSocketMessage(data: any, onGameEnd: (winner: string) => void): void {
  switch (data.type) {
    case 'auth_success':
      break;

    case 'game_state':
    case 'game_update':
      updateScene(data.state);
      break;

    case 'countdown':
      updateScene({ ...data.state, countdown: data.number, namesSet: false });
      break;

    case 'round_pause':
      updateScene({ holdUntil: performance.now() + 1500 });
      rollNeonColor();
      break;

    case 'game_started':
      rollNeonColor();
      updateScene({ countdown: null });
      console.log('Game started');
      break;

    case 'game_ended':
      onGameEnd(data.winner);
      break;

    case 'tournament_match_start':
      (window as any).navigate(`/game/pong?game_id=${data.game_id}&tournament_id=${data.tournament_id}`);
      break;

    case 'tournament_update':
      // (window as any).navigate(`/tournament/${data.tournament_id}`);
      break;

    case 'powerup_spawned':
    case 'powerup_collected':
    case 'extra_ball_spawned':
    case 'extra_ball_removed':
    case 'all_extra_balls_cleared':
    case 'powerup_ended':
    case 'paddle_speed_changed':
    case 'paddle_size_changed':
    case 'powerup_expired':
    case 'all_powerups_cleared':
      updateScene(data.state || {});
      break;

    default:
      console.warn('Unknown message type:', data.type);
  }
}

export function sendPaddleMove(ws: WebSocket, input: any): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'paddle_move', ...input }));
  }
}
