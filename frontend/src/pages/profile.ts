// pages/profile.ts
import { checkAuthStatus, getUserStats, checkFriendshipStatus, sendFriendRequest, inviteFriendToGame, removeFriend } from '../services';
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

  return `
    <div class="max-w-4xl mx-auto bg-gray-800 p-6 rounded-lg">
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
              <button id="add-friend-btn" class="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700">
                Add Friend
              </button>
            ` : friendshipStatus === 'pending' ? `
              <button class="bg-gray-600 px-4 py-2 rounded cursor-not-allowed" disabled>
                Friend Request Pending
              </button>
            ` : friendshipStatus === 'accepted' ? `
              <div class="flex gap-2 justify-center">
                <button id="play-with-friend" class="bg-green-600 px-4 py-2 rounded hover:bg-green-700">
                  Play Game
                </button>
                <button id="remove-friend" class="bg-red-600 px-4 py-2 rounded hover:bg-red-700">
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
