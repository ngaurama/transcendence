// services/UserWebSocket.ts
import { showRematchInvitation } from '../utils/notification';

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

  console.log("DATA FOR WEBSOCKET: ", data);
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

    case 'game_invitation_received':
      showRematchInvitation(data.inviter_name, data.game_id, data.game_settings);
      break;

    case 'game_invitation_accepted':
      (window as any).navigate(`/game/pong?game_id=${data.game_id}`);
      if ((window as any).pendingRematch?.gameId === data.game_id) {
        delete (window as any).pendingRematch;
      }
      break;

    case 'game_invitation_declined':
      alert('Your rematch invitation was declined.');
      if ((window as any).pendingRematch?.gameId === data.game_id) {
        const rematchBtn = document.getElementById('rematch');
        if (rematchBtn) {
          rematchBtn.textContent = (window as any).pendingRematch.originalText;
          // rematchBtn.disabled = false;
        }
        delete (window as any).pendingRematch;
      }
      break;

    case 'tournament_match_start':
      (window as any).navigate(`/game/pong?game_id=${data.game_id}&tournament_id=${data.tournament_id}`);
      break;

    case 'tournament_update':
      // (window as any).navigate(`/tournament/${data.tournament_id}`);
      break;

    case 'tournament_created':
      if (typeof (window as any).addTournamentToList === 'function') {
        (window as any).addTournamentToList(data.tournament);
      }
      break;

    case 'tournament_joined':
      if (typeof (window as any).updateTournamentParticipants === 'function') {
        (window as any).updateTournamentParticipants(data.tournament_id, data.participants);
      }
      if (typeof (window as any).refreshTournamentParticipants === 'function') {
        (window as any).refreshTournamentParticipants(data.participants);
      }
      break;

    case 'tournament_started':
      // if ((window as any).currentTournamentId === data.tournament_id) {
        (window as any).navigate(`/tournament/${data.tournament_id}`);
      // }
      break;

    default:
      console.warn('Unknown user WebSocket message type:', data.type);
  }
}
