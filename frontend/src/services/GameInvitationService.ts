// services/GameInvitationService.ts

import { checkAuthStatus, getFriendsList } from ".";
import { getUserStats, requestMatch } from "./PongService";

export async function inviteFriendToGame(friendId: number): Promise<void> {
  try {
    const existingPopup = document.getElementById("invite-popup");
    if (existingPopup) existingPopup.remove();

    const popup = document.createElement("div");
    popup.id = "invite-popup";
    popup.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4";
    
    popup.innerHTML = `
      <div class="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
        <h3 class="text-xl mb-4 text-center">Invite Friend to Game</h3>
        
        <div class="space-y-4">
          <div>
            <label class="block mb-2 text-gray-300">Points to Win:</label>
            <select id="popup-points-to-win" class="w-full p-2 bg-gray-700 rounded">
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="15">15</option>
            </select>
          </div>
          
          <div>
            <label class="block mb-2 text-gray-300">Powerups:</label>
            <select id="popup-powerups" class="w-full p-2 bg-gray-700 rounded">
              <option value="false">Disabled</option>
              <option value="true">Enabled</option>
            </select>
          </div>
          
          <div>
            <label class="block mb-2 text-gray-300">Board Variant:</label>
            <select id="popup-board-variant" class="w-full p-2 bg-gray-700 rounded mb-4">
              <option value="classic">Classic</option>
              <option value="neon">Neon</option>
              <option value="space">Space</option>
            </select>
          </div>
          
          <div class="flex space-x-4">
            <button id="popup-cancel" class="flex-1 bg-gray-600 p-3 rounded hover:bg-gray-700">
              Cancel
            </button>
            <button id="popup-confirm" class="flex-1 bg-green-600 p-3 rounded hover:bg-green-700">
              Send Invite
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(popup);

    const cancelBtn = document.getElementById("popup-cancel")!;
    const confirmBtn = document.getElementById("popup-confirm")!;

    const closePopup = () => {
      popup.remove();
    };

    popup.addEventListener('click', (e) => {
      if (e.target === popup) {
        closePopup();
      }
    });

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePopup();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    cancelBtn.addEventListener("click", closePopup);
    
    confirmBtn.addEventListener("click", async () => {
      const points_to_win = parseInt((document.getElementById("popup-points-to-win") as HTMLSelectElement).value) || 5;
      const powerups_enabled = (document.getElementById("popup-powerups") as HTMLSelectElement).value === "true";
      const board_variant = (document.getElementById("popup-board-variant") as HTMLSelectElement).value || "classic";
      const user = await checkAuthStatus();
      const friends = await getFriendsList();
      const friend = friends.find(f => f.id === friendId);

      try {
        const options: any = {
            gameMode: 'online',
            gametype: '2player',
            points_to_win,
            powerups_enabled,
            board_variant,
            player1_name: user?.display_name,
            player2_name: friend.display_name,
        };

        await requestMatch(options, friendId);

        alert('Game invitation sent successfully!');
        closePopup();
      } catch (error) {
        console.error('Invite failed:', error);
        alert('Failed to send invite: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    });
  } catch (error) {
    console.error("Invite failed:", error);
    alert("Failed to send invite");
  }
}

export async function acceptGameInvitation(invitationId: string): Promise<string> {
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetch(`/api/pong/game/invitation/accept/${invitationId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      throw new Error('Failed to accept game invitation');
    }

    const data = await res.json();
    return data.game_id;
  } catch (error) {
    throw error;
  }
}

export async function declineGameInvitation(invitationId: string): Promise<void> {
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetch(`/api/pong/game/invitation/decline/${invitationId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      throw new Error('Failed to decline game invitation');
    }
  } catch (error) {
    throw error;
  }
}
