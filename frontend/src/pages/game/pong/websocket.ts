import { GameState } from './types';
import { updateScene } from './renderer';
import { rollNeonColor } from './utils';


export function createWebSocketHandler(
  gameId: string,
  token: string | null,
  gameOptions: any,
  onGameEnd: (winner: string) => void,
  cleanup: () => void
): WebSocket {

  const ws = new WebSocket(`wss://${window.location.host}/api/pong/wss?game_id=${gameId}`);

  ws.onopen = () => {
    console.log('WebSocket connected successfully');

    if (gameOptions.gameMode === 'local') {
      if (sessionStorage.getItem('pong_connected')) {
        ws.send(JSON.stringify({ type: 'refresh' }));
      } else {
        sessionStorage.setItem('pong_connected', 'true');
      }
    }

    ws.send(JSON.stringify({ type: 'auth', token }));
  };

  if (gameOptions.gameMode !== 'local') {
    const handleBeforeUnload = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'refresh' }));
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data, onGameEnd, cleanup);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = (event) => {
    console.log('WebSocket closed:', event.code, event.reason);
    if (event.code === 4006) {
      alert('This game has already finished and game room is closed. Returning to home.');
      cleanup();
      (window as any).navigate('/');
    }
  };

  return ws;
}

function handleWebSocketMessage(
  data: any,
  onGameEnd: (winner: string) => void,
  cleanup: () => void
): void {
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
      // console.log('Game started');
      break;

    case 'game_ended':
      console.log("GAME ENDED DATA:", data);
      if (data.reason === 'opponent_disconnected') {
        alert('Opponent disconnected. You win by default!');
        onGameEnd(data.winner);
        cleanup();
        (window as any).navigate('/');
      } else {
        onGameEnd(data.winner);
        // cleanup();
      }
      break;

    case 'game_abandoned_local':
      alert('Game abandoned due to disconnection. Returning to home.');
      cleanup();
      (window as any).navigate('/');
      break;

    // case 'game_abandoned_online':
    //   alert('Game lost due to disconnection1. Returning to home.');
    //   cleanup();
    //   (window as any).navigate('/');
    //   break;

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
