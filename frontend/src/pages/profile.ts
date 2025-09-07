// pages/profile.ts
import { checkAuthStatus, getUserStats, checkFriendshipStatus, sendFriendRequest, inviteFriendToGame, removeFriend } from '../services';
import { initWinLossChart } from '../utils/chart';
import { renderStatsContent } from './dashboard';

export async function profilePage(): Promise<string> {
  const urlParams = new URLSearchParams(window.location.search);
  const userId = (window as any).profileUserId;
  const currentUser = await checkAuthStatus();
  
  if (!userId) {
    (window as any).navigate('/');
    return '';
  }


  const userStats = await getUserStats(userId);
  const isOwnProfile = currentUser?.id.toString() === userId;
  const friendshipStatus = isOwnProfile ? 'self' : await checkFriendshipStatus(userId);

  setTimeout(() => {
    if (userStats.stats) {
      initWinLossChart(userStats.stats);
    }  
  }, 100);

  return `
     <div class="glass-card max-w-4xl mx-auto bg-gray-800 p-6 rounded-lg">
      <!-- Back Arrow -->
      <div class="mb-4">
        <button onclick="navigateBack()" class="flex items-center text-gray-400 hover:text-white transition-colors">
          <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>
      </div>
      <!-- Profile Header -->
      <div class="text-center mb-6">
        <img src="${userStats.targetUser.avatar_url}" alt="Avatar" 
             class="w-32 h-32 rounded-full mx-auto mb-4 border-4 border-gray-600">
        <h2 class="text-2xl font-bold">${userStats.targetUser.display_name}</h2>
        <p class="text-gray-400">@${userStats.targetUser.username}</p>
        <p class="text-sm text-gray-500">Joined ${new Date(userStats.targetUser.created_at).toLocaleDateString()}</p>
        
        ${!isOwnProfile ? `
          <div class="mt-4">
            ${friendshipStatus === 'not_friends' ? `
              <button id="add-friend-btn" class="glass-button bg-blue-600 px-4 py-2 rounded hover:bg-blue-700">
                Add Friend
              </button>
            ` : friendshipStatus === 'pending' ? `
              <button class="glass-button bg-gray-600 px-4 py-2 rounded cursor-not-allowed" disabled>
                Friend Request Pending
              </button>
            ` : friendshipStatus === 'accepted' ? `
              <div class="flex gap-2 justify-center">
                <button id="play-with-friend" class="glass-button bg-green-600 px-4 py-2 rounded hover:bg-green-700">
                  Play Game
                </button>
                <button id="remove-friend" class="glass-button bg-red-600 px-4 py-2 rounded hover:bg-red-700">
                  Remove Friend
                </button>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>

      <!-- Stats Content (same as dashboard but read-only) -->
      <div id="profile-stats">
        ${await renderStatsContent(userStats, false, currentUser)}
      </div>
    </div>
  `;
}

export async function attachProfileListeners(userId: string) {
  const currentUser = await checkAuthStatus();
  
  if (!userId || currentUser?.id.toString() === userId) return;

  document.querySelectorAll('.recent-game-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const gameId = item.getAttribute('data-game-id');
      const detailsElement = document.getElementById(`game-details-${gameId}`);
      
      document.querySelectorAll('[id^="game-details-"]').forEach(detail => {
        if (detail.id !== `game-details-${gameId}`) {
          detail.classList.add('hidden');
        }
      });
      
      if (detailsElement) {
        detailsElement.classList.toggle('hidden');
      }
    });
  });

  const addFriendBtn = document.getElementById('add-friend-btn');
  const playWithFriendBtn = document.getElementById('play-with-friend');
  const removeFriendBtn = document.getElementById('remove-friend');

  if (addFriendBtn) {
    addFriendBtn.addEventListener('click', async () => {
      try {
        await sendFriendRequest(userId);
        alert('Friend request sent!');
        addFriendBtn.textContent = 'Friend Request Pending';
        addFriendBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        addFriendBtn.classList.add('bg-gray-600', 'cursor-not-allowed');
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to send friend request');
      }
    });
  }

  if (playWithFriendBtn) {
    playWithFriendBtn.addEventListener('click', () => {
      inviteFriendToGame(parseInt(userId));
    });
  }

  if (removeFriendBtn) {
    removeFriendBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to remove this friend?')) {
        try {
          await removeFriend(parseInt(userId));
          alert('Friend removed');
          (window as any).navigate('/dashboard');
        } catch (error) {
          alert('Failed to remove friend');
        }
      }
    });
  }
}
