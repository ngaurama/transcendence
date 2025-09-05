// services/UserWebSocket.ts
import { acceptFriendRequest, getFriendsList, rejectFriendRequest } from './FriendsService';
import { acceptGameInvitation, declineGameInvitation } from './GameInvitationService';
import { showMatchInvitation } from './NotificationService';

let userWs: WebSocket | null = null;
let reconnectTimeout: number | null = null;
const RECONNECT_DELAY = 2000;

export function initUserWebSocket(): WebSocket | null {
  if (userWs && userWs.readyState === WebSocket.OPEN) {
    console.log('WebSocket already connected');
    return userWs;
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  const token = localStorage.getItem('access_token');
  if (!token) {
    console.log('No token available for WebSocket connection');
    return null;
  }
  if (userWs) {
    userWs.close();
    userWs = null;
  }

  console.log('Creating new WebSocket connection');
  userWs = new WebSocket(`wss://${window.location.host}/api/pong/ws/user`);

  userWs.onopen = () => {
    console.log('Connected to User WS');
    userWs!.send(JSON.stringify({ type: 'auth', token }));
  };

  userWs.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleUserWebSocketMessage(data);
    } catch (error) {
      console.error('Error parsing User WebSocket message:', error);
    }
  };

  userWs.onerror = (error) => {
    console.error('User WebSocket error:', error);
  };

  userWs.onclose = (event) => {
    console.log('User WebSocket closed:', event.code, event.reason);
    
    if (event.code !== 1000 && localStorage.getItem('access_token')) {
      console.log('Will attempt reconnect in', RECONNECT_DELAY, 'ms');
      reconnectTimeout = setTimeout(() => {
        initUserWebSocket();
      }, RECONNECT_DELAY);
    } else {
      userWs = null;
    }
  };

  return userWs;
}

export function closeUserWebSocket(): void {
  if (userWs) {
    userWs.close(1000, 'Normal closure');
    userWs = null;
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
}

function handleUserWebSocketMessage(data: any): void {
  // console.log("DATA WS", data);
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
      showMatchInvitation(data.inviter_name, data.game_id, data.game_settings);
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

    
    case 'friend_request_received':
      showFriendRequestNotification(data.from_user, data.request_id);
      break;
      
    case 'friend_request_accepted':
      showFriendRequestAccepted(data.friend);
      refreshFriendsList();
      break;
      
    case 'friend_online':
      updateFriendStatus(data.user_id, 'online');
      break;
      
    case 'friend_offline':
      updateFriendStatus(data.user_id, 'offline');
      break;
      
    case 'friend_playing':
      updateFriendStatus(data.user_id, 'playing', data.game_id);
      break;

    default:
      console.warn('Unknown user WebSocket message type:', data.type);
  }
}


function showFriendRequestNotification(fromUser: any, requestId: string): void {
  const notification = document.createElement('div');
  notification.className = 'fixed bottom-4 right-4 bg-white p-4 rounded shadow-lg border z-50 max-w-sm';
  notification.innerHTML = `
    <h4 class="font-bold mb-2 text-gray-800">Friend Request</h4>
    <p class="text-gray-600 mb-3">${fromUser.display_name} wants to be your friend!</p>
    <div class="flex justify-between">
      <button class="accept-friend-request bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
              data-request-id="${requestId}">
        Accept
      </button>
      <button class="reject-friend-request bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
              data-request-id="${requestId}">
        Reject
      </button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  notification.querySelector('.accept-friend-request')?.addEventListener('click', async () => {
    try {
      await acceptFriendRequest(requestId);
      notification.remove();
      refreshFriendsList();
    } catch (error) {
      console.error('Error accepting friend request:', error);
    }
  });
  
  notification.querySelector('.reject-friend-request')?.addEventListener('click', async () => {
    try {
      await rejectFriendRequest(requestId);
      notification.remove();
    } catch (error) {
      console.error('Error rejecting friend request:', error);
    }
  });
  
  setTimeout(() => {
    if (document.body.contains(notification)) {
      notification.remove();
    }
  }, 30000);
}


function showFriendRequestAccepted(friend: any): void {
  const notification = document.createElement('div');
  notification.className = 'fixed bottom-4 right-4 bg-white p-4 rounded shadow-lg border z-50 max-w-sm';
  notification.innerHTML = `
    <h4 class="font-bold mb-2 text-gray-800">Friend Request Accepted</h4>
    <p class="text-gray-600 mb-3">${friend.display_name} is now your friend!</p>
    <button class="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
            onclick="navigate('/dashboard')">
      View Friends
    </button>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (document.body.contains(notification)) {
      notification.remove();
    }
  }, 10000);
}

export async function refreshFriendsList(): Promise<void> {
  const friendsList = document.getElementById('friends-list');
  if (!friendsList) return;

  try {
    const friends = await getFriendsList();
    friendsList.innerHTML = friends.length > 0 ? friends.map(friend => `
      <div class="flex items-center justify-between p-3 bg-gray-800 rounded">
        <div class="flex items-center">
          <img src="${friend.avatar_url}" class="w-10 h-10 rounded-full mr-3">
          <div>
            <div class="font-semibold">${friend.display_name}</div>
            <div class="text-sm text-gray-400 flex items-center">
              <span class="inline-block w-2 h-2 rounded-full mr-1 
                           ${friend.online_status === 'online' ? 'bg-green-400' : 
                             friend.online_status === 'playing' ? 'bg-blue-400' : 'bg-gray-400'}"></span>
              ${friend.online_status === 'online' ? 'Online' : 
               friend.online_status === 'playing' ? 'In Game' : 'Offline'}
              ${friend.current_activity ? `- ${friend.current_activity}` : ''}
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <button class="view-profile-btn bg-gray-600 px-3 py-1 rounded text-sm hover:bg-gray-700"
                  data-user-id="${friend.id}">
            Profile
          </button>
          <button class="play-friend-btn bg-green-600 px-3 py-1 rounded text-sm hover:bg-green-700"
                  data-user-id="${friend.id}" data-username="${friend.username}">
            Play
          </button>
          <button class="remove-friend-btn bg-red-600 px-3 py-1 rounded text-sm hover:bg-red-700"
                  data-user-id="${friend.id}">
            Remove
          </button>
        </div>
      </div>
    `).join('') : '<p class="text-gray-400 text-center py-4">No friends yet. Search for users to add friends!</p>';
  } catch (error) {
    console.error('Failed to refresh friends list:', error);
    friendsList.innerHTML = '<p class="text-red-400 text-center py-4">Failed to load friends</p>';
  }
}

function updateFriendStatus(userId: string, status: string, gameId?: string): void {
  const friendElement = document.querySelector(`[data-user-id="${userId}"]`)?.closest('.flex.items-center.justify-between');
  if (!friendElement) return;

  const statusElement = friendElement.querySelector('.text-sm.text-gray-400');
  if (statusElement) {
    statusElement.innerHTML = `
      <span class="inline-block w-2 h-2 rounded-full mr-1 
                    ${status === 'online' ? 'bg-green-400' : 
                      status === 'playing' ? 'bg-blue-400' : 'bg-gray-400'}"></span>
      ${status === 'online' ? 'Online' : 
       status === 'playing' ? 'In Game' : 'Offline'}
      ${status === 'playing' && gameId ? `- Playing Game ${gameId}` : ''}
    `;
  }
}

function showGameInvitation(inviter: any, gameId: string, gameSettings: any): void {
  const notification = document.createElement('div');
  notification.className = 'fixed bottom-4 right-4 bg-white p-4 rounded shadow-lg border z-50 max-w-sm';
  notification.innerHTML = `
    <h4 class="font-bold mb-2 text-gray-800">Game Invitation</h4>
    <p class="text-gray-600 mb-3">${inviter.display_name} invited you to a game!</p>
    <p class="text-sm text-gray-500">Settings: ${JSON.stringify(gameSettings)}</p>
    <div class="flex justify-between mt-3">
      <button id="accept-game-invitation" class="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">✓ Accept</button>
      <button id="decline-game-invitation" class="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600">✗ Decline</button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  document.getElementById('accept-game-invitation')?.addEventListener('click', async () => {
    try {
      await acceptGameInvitation(gameId);
      notification.remove();
    } catch (error) {
      console.error('Error accepting game invitation:', error);
      alert('Failed to accept game invitation');
      notification.remove();
    }
  });
  
  document.getElementById('decline-game-invitation')?.addEventListener('click', async () => {
    try {
      await declineGameInvitation(gameId);
      notification.remove();
    } catch (error) {
      console.error('Error declining game invitation:', error);
      notification.remove();
    }
  });
  
  setTimeout(() => {
    if (document.body.contains(notification)) {
      notification.remove();
    }
  }, 30000);
}

function showFriendRequestRejected(addresseeId: string): void {
  const notification = document.createElement('div');
  notification.className = 'fixed bottom-4 right-4 bg-white p-4 rounded shadow-lg border z-50 max-w-sm';
  notification.innerHTML = `
    <h4 class="font-bold mb-2 text-gray-800">Friend Request Rejected</h4>
    <p class="text-gray-600 mb-3">Your friend request was rejected.</p>
    <button class="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
            onclick="notification.remove()">
      Close
    </button>
  `;
  document.body.appendChild(notification);
  setTimeout(() => {
    if (document.body.contains(notification)) {
      notification.remove();
    }
  }, 10000);
}
