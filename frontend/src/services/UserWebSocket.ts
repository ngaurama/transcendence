// services/UserWebSocket.ts
export function initUserWebSocket(): WebSocket | null {
  const token = localStorage.getItem('access_token');
  if (!token) return null;

  const ws = new WebSocket(`wss://${window.location.host}/api/pong/ws/user`);

  ws.onopen = () => {
    console.log('Connected to User WS');
    ws.send(JSON.stringify({ type: 'auth', token }));
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleUserWebSocketMessage(data);
    } catch (error) {
      console.error('Error parsing User WebSocket message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('User WebSocket error:', error);
  };

  ws.onclose = (event) => {
    console.log('User WebSocket closed:', event.code, event.reason);
  };

  return ws;
}

function handleUserWebSocketMessage(data: any): void {
  switch (data.type) {
    case 'auth_success':
      console.log('User WebSocket authenticated');
      break;

    case 'match_found':
      if (typeof (window as any).cancelMatchmaking === 'function') {
        (window as any).cancelMatchmaking();
      }
      (window as any).navigate(`/game/pong?game_id=${data.game_id}`);
      break;

    // case 'match_found':
    //   (window as any).navigate(`/game/pong?game_id=${data.game_id}`);
    //   break;

    case 'tournament_match_start':
      (window as any).navigate(`/game/pong?game_id=${data.game_id}&tournament_id=${data.tournament_id}`);
      break;

    case 'tournament_update':
      (window as any).navigate(`/tournament/${data.tournament_id}`);
      break;

    default:
      console.warn('Unknown user WebSocket message type:', data.type);
  }
}
