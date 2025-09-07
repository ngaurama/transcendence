// pages/dashboard.ts
import { checkAuthStatus, getUserStats, getFriendsList, searchUsers, sendFriendRequest, getFriendRequests, removeFriend, inviteFriendToGame, acceptFriendRequest, rejectFriendRequest, updateProfile, uploadAvatar } from '../services';
import { refreshFriendsList } from '../services/UserWebSocket';
import { initWinLossChart } from '../utils/chart';

export async function dashboardPage(): Promise<string> {
  const user = await checkAuthStatus();
  if (!user) {
    (window as any).navigate('/');
    return '';
  }

  (window as any).dashboardHistory.push('/dashboard');

  const fullStats = await getUserStats(user.id);
  const friends = await getFriendsList();
  const isOAuthUser = user.oauth_provider && user.oauth_provider !== 'local';
  const isDefaultAvatar = user.avatar_url === '/avatars/default.png';

  setTimeout(() => {
    if (fullStats.stats) {
      initWinLossChart(fullStats.stats);
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
      <!-- User Profile Header -->
      <div class="text-center mb-6">
        <!-- Avatar Section -->      
        <div class="flex justify-center mb-6">
          <div class="relative group">
            <!-- Avatar Image -->
            <div class="relative cursor-pointer" id="avatar-trigger">
              <img 
                src="${user.avatar_url}" 
                alt="Avatar" 
                class="w-32 h-32 rounded-full border-4 border-gray-600 hover:border-purple-500 transition-colors"
              >
              <div class="absolute inset-0 bg-black bg-opacity-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
              </div>
            </div>

            <!-- Avatar Dropdown Menu -->
            <div id="avatar-dropdown" class="hidden absolute left-1/2 transform -translate-x-1/2 mt-2 w-48 bg-gray-700 rounded-md shadow-lg py-1 z-50">
              <input 
                type="file" 
                id="avatar-file-input" 
                accept="image/png,image/jpeg" 
                class="hidden"
              >
              <button 
                onclick="document.getElementById('avatar-file-input').click()" 
                class="glass-button block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-600"
              >
                Upload new avatar
              </button>
              ${!isDefaultAvatar ? `
                <button 
                  id="remove-avatar-btn" 
                  class="glass-button block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-600"
                >
                  Remove avatar
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Display Name -->
        <div class="mt-2">
          <div class="relative inline-block group">
            <span id="display-name-text" class="text-2xl font-bold">${user.display_name}</span>
            ${user.id === (await checkAuthStatus())?.id ? `
              <svg id="edit-display-name" class="w-5 h-5 text-gray-400 absolute -right-7 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536M4 13.5V19h5.5l11-11-5.5-5.5-11 11z" />
              </svg>
            ` : ''}
          </div>
        </div>

        <!-- Username -->
        <div class="text-gray-400">
          <div class="relative inline-block group">
            <span id="username-text">@${user.username}</span>
            ${user.id === (await checkAuthStatus())?.id && !isOAuthUser ? `
              <svg id="edit-username" class="w-5 h-5 text-gray-400 absolute -right-7 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536M4 13.5V19h5.5l11-11-5.5-5.5-11 11z" />
              </svg>
            ` : ''}
          </div>
        </div>

        <p class="text-sm text-gray-500">Joined ${new Date(user.created_at).toLocaleDateString()}</p>
      </div>

      <!-- Tabs Navigation -->
      <div class="flex border-b justify-between border-gray-700 mb-6">
        <button id="stats-tab" class="tab-button active px-4 py-2 text-blue-400 border-b-2 border-blue-400 hover:rounded-t-lg">
          Statistics
        </button>
        <button id="friends-tab" class="tab-button px-4 py-2 text-gray-400 hover:text-white hover:rounded-t-lg">
          Friends
        </button>
        ${user.id === (await checkAuthStatus())?.id ? `
          <button id="settings-tab" class="tab-button px-4 py-2 text-gray-400 hover:text-white hover:rounded-t-lg">
            Settings
          </button>
        ` : ''}
      </div>

      <!-- Stats Tab Content -->
      <div id="stats-content" class="tab-content">
        ${await renderStatsContent(fullStats, user.id === (await checkAuthStatus())?.id, user)}
      </div>

      <!-- Friends Tab Content -->
      <div id="friends-content" class="tab-content hidden">
        ${renderFriendsContent(friends, user.id === (await checkAuthStatus())?.id)}
      </div>

      <!-- Settings Tab Content (only for own profile) -->
      ${user.id === (await checkAuthStatus())?.id ? `
        <div id="settings-content" class="tab-content hidden">
          ${renderSettingsContent(user)}
        </div>
      ` : ''}
    </div>
  `;
}

export async function renderStatsContent(fullStats: any, isOwnProfile: boolean, user: any): Promise<string> {
  return `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Overall Stats -->
      <div class="glass-card bg-gray-800 p-4 rounded">
        <h3 class="text-lg font-semibold mb-3">Overall Performance</h3>
        <div class="grid grid-cols-2 gap-2">
          <div class="glass-card b-4 text-center p-3 bg-gray-900 rounded">
            <div class="text-2xl font-bold">${fullStats.stats.games_played || 0}</div>
            <div class="text-sm text-gray-300">Games Played</div>
          </div>
          <div class="glass-card text-center p-3 bg-gray-900 rounded">
            <div class="text-2xl font-bold text-green-400">${fullStats.stats.games_won || 0}</div>
            <div class="text-sm text-gray-300">Wins</div>
          </div>
          <div class="glass-card text-center p-3 bg-gray-900 rounded">
            <div class="text-2xl font-bold text-red-400">${fullStats.stats.games_lost || 0}</div>
            <div class="text-sm text-gray-300">Losses</div>
          </div>
          <div class="glass-card text-center p-3 bg-gray-900 rounded">
            <div class="text-2xl font-bold">${Math.round((fullStats.stats.games_won || 0) / (fullStats.stats.games_played || 1) * 100)}%</div>
            <div class="text-sm text-gray-300">Win Rate</div>
          </div>
        </div>
      </div>

      <!-- Win/Loss Chart with Toggle -->
      <div class="glass-card bg-gray-800 p-4 rounded">
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-lg font-semibold">Performance Charts</h3>
          <div class="flex space-x-2">
            <!-- <button id="win-loss-chart-btn" class="disabled chart-toggle-btn bg-blue-600 text-white px-2 py-1 rounded text-xs active">
              Win/Loss
            </button> -->
          </div>
        </div>

        <!-- Chart container showing win/loss -->
        <div class="relative">
          <canvas id="win-loss-chart" class="w-full h-48"></canvas>
        </div>
      </div>

      <!-- Recent Games -->
      <div class="glass-card recent-games-dropdown md:col-span-2 bg-gray-900 p-4 rounded">
        <h3 class="text-lg font-semibold mb-4 mt-2">Recent Games</h3>
        <div class="space-y-2">
          ${
            fullStats.recent_games && fullStats.recent_games.length > 0
              ? fullStats.recent_games
                  .map((game: any) => {
                    const userPlayerNumber = user.id === game.player1.id ? game.player1 : game.player2;
                    const opponentPlayerNumber = user.id === game.player1.id ? game.player2 : game.player1;

                    const userWin = game.winner_id === user.id;
                    const opponentWin = game.winner_id !== user.id;

                    return `
                      <div class="glass-card flex flex-col bg-gray-900 rounded recent-game-item hover:bg-gray-900" data-game-id="${game.id}">
                        <!-- Main line -->
                        <div class="flex items-center justify-between p-2 cursor-pointer">
                          
                          <!-- Player 1 (left) -->
                          <div class="flex items-center space-x-2 w-1/3">
                            <img src="${userPlayerNumber.avatar_url}" class="w-8 h-8 rounded-full">
                            <span class="font-semibold">${userPlayerNumber.name}</span>
                            <span class="${userWin ? 'text-green-400' : 'text-red-400'} font-bold">
                              ${userWin ? 'WIN' : 'LOSS'}
                            </span>
                          </div>

                          <!-- Score (center) -->
                          <div class="flex justify-center w-1/3 text-lg font-bold space-x-1">
                            <span class="${userWin ? 'text-green-400' : 'text-red-400'}">${userPlayerNumber.score}</span>
                            <span>-</span>
                            <span class="${opponentWin ? 'text-green-400' : 'text-red-400'}">${opponentPlayerNumber.score}</span>
                          </div>

                          <!-- Player 2 (right) -->
                          <div class="flex items-center justify-end space-x-2 w-1/3">
                            <span class="${opponentWin ? 'text-green-400' : 'text-red-400'} font-bold">
                              ${opponentWin ? 'WIN' : 'LOSS'}
                            </span>
                            <span class="font-semibold">${opponentPlayerNumber.name}</span>
                            <img src="${opponentPlayerNumber.avatar_url || '/avatars/default.png'}" class="w-8 h-8 rounded-full">
                          </div>

                        </div>

                        <!-- Dropdown/details -->
                        <div id="game-details-${game.id}" class="hidden glass-card bg-gray-800 p-3 rounded mt-1 text-sm">
                          <div class="grid grid-cols-2 gap-2">
                            <div><strong>Date:</strong> ${new Date(game.created_at + "Z").toLocaleString()}</div>
                            <div><strong>Duration:</strong> ${Math.round(game.game_duration_ms / 1000)}s</div>
                            <div><strong>Powerups:</strong> ${JSON.parse(game.game_settings).powerups_enabled ? 'Yes' : 'No'}</div>
                            <div><strong>Variant:</strong> ${JSON.parse(game.game_settings).board_variant}</div>
                            <div><strong>Points to win:</strong> ${JSON.parse(game.game_settings).points_to_win}</div>
                            <div><strong>Type:</strong> ${game.game_type === 'local' ? 'Local' : 'Online'}</div>
                          </div>
                        </div>
                      </div>
                    `;
                  })
                .join('')
              : '<p class="text-gray-400 text-center py-4">No games played yet</p>'
          }
        </div>
      </div>

      <!-- Tournament Performance -->
      ${fullStats.stats.tournament_stats && fullStats.stats.tournament_stats.length > 0 ? `
        <div class="glass-card md:col-span-2 bg-gray-800 p-4 rounded">
          <h3 class="text-lg font-semibold mb-3">Tournament Performance</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            ${fullStats.stats.tournament_stats.map((tournament: any) => `
              <div class="bg-gray-800 p-3 rounded">
                <h4 class="font-semibold">${tournament.name}</h4>
                <p class="text-sm text-gray-400">
                  ${tournament.performance === 'winner' ? '🏆 Winner' : 
                    tournament.performance === 'top3' ? '🥉 Top 3' : 'Participant'}
                </p>
                ${tournament.final_position ? `
                  <p class="text-sm">Final Position: ${tournament.final_position}</p>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderFriendsContent(friends: any[], isOwnProfile: boolean): string {
  if (!isOwnProfile) {
    return '<p class="text-gray-400 text-center py-8">Friends list is only visible to the account owner</p>';
  }

  return `
    <div class="grid grid-cols-1 gap-6">
      <!-- Add Friend Section -->
      <div class="glass-card bg-gray-800 p-4 rounded">
        <h3 class="text-lg font-semibold mb-3">Add Friend</h3>
        <div class="flex gap-2">
          <input type="text" class="glass-input" id="friend-search" placeholder="Search by username..." 
                 class="flex-1 p-2 bg-gray-800 rounded border border-gray-700">
          <button id="search-friend-btn" class="glass-button glass-button bg-blue-600 px-4 py-2 rounded hover:bg-blue-700">
            Search
          </button>
        </div>
        <div id="search-results" class="mt-3 hidden"></div>
      </div>

      <!-- Friends List -->
      <div class="glass-card bg-gray-800 p-4 rounded">
        <h3 class="text-lg font-semibold mb-3">Friends (${friends.length})</h3>
        <div id="friends-list" class="space-y-2">
          ${friends.length > 0 ? friends.map(friend => `
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
                <button class="glass-button view-profile-btn bg-gray-600 px-3 py-1 rounded text-sm hover:bg-gray-700"
                        data-user-id="${friend.id}">
                  Profile
                </button>
                <button class="glass-button play-friend-btn bg-green-600 px-3 py-1 rounded text-sm hover:bg-green-700"
                        data-user-id="${friend.id}" data-username="${friend.username}">
                  Play
                </button>
                <button class="glass-button remove-friend-btn bg-red-600 px-3 py-1 rounded text-sm hover:bg-red-700"
                        data-user-id="${friend.id}">
                  Remove
                </button>
              </div>
            </div>
          `).join('') : 
          '<p class="text-gray-400 text-center py-4">No friends yet. Search for users to add friends!</p>'}
        </div>
      </div>

      <!-- Pending Requests -->
      <div class="glass-card bg-gray-800 p-4 rounded">
        <h3 class="text-lg font-semibold mb-3">Pending Requests</h3>
        <div id="pending-requests" class="space-y-2">
        </div>
      </div>
    </div>
  `;
}

function renderSettingsContent(user: any): string {
  const isOAuthUser = user.oauth_provider && user.oauth_provider !== 'local';
  
  return `
    <div class="space-y-4">
      <div class="glass-card bg-gray-800 p-4 rounded">
        <h3 class="text-lg font-semibold mb-3">Account Settings</h3>
          ${!isOAuthUser
          ? `
          <button onclick="navigate('/change-password')" class="w-full bg-blue-500 p-2 rounded mb-2">
            Change Password
          </button>
          <button onclick="navigate('/2fa-setup')" class="w-full bg-purple-500 p-2 rounded mb-2">
            ${user.totp_enabled ? 'Manage 2FA' : 'Setup 2FA'}
          </button>
        `
          : `
          <p class="text-sm text-gray-400 mb-4">
            Account management is handled through ${user.oauth_provider === 'fortytwo' ? "42" : user.oauth_provider}.
          </p>
        `}
      </div>
      
      <div class="glass-card bg-gray-800 p-4 rounded">
        <h3 class="text-lg font-semibold mb-3">Privacy & Data</h3>
        <button onclick="navigate('/gdpr')" class="glass-button w-full bg-blue-600 p-2 rounded mb-2">
          GDPR Compliance Center
        </button>
      </div>
    </div>
  `;
}

export function attachDashboardListeners() {
  const avatarTrigger = document.getElementById('avatar-trigger');
  const avatarDropdown = document.getElementById('avatar-dropdown');
  const avatarFileInput = document.getElementById('avatar-file-input') as HTMLInputElement;
  const removeAvatarBtn = document.getElementById('remove-avatar-btn');
  const winLossChartBtn = document.getElementById('win-loss-chart-btn');
  const winLossChart = document.getElementById('win-loss-chart');

  if (avatarTrigger && avatarDropdown) {
    avatarTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      avatarDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!avatarTrigger.contains(e.target as Node) && !avatarDropdown.contains(e.target as Node)) {
        avatarDropdown.classList.add('hidden');
      }
    });
  }

  if (avatarFileInput) {
    avatarFileInput.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const token = localStorage.getItem('access_token');
      if (!token) {
        alert('Please log in to upload avatar');
        return;
      }

      const allowedTypes = ['image/png', 'image/jpeg'];
      if (!allowedTypes.includes(file.type)) {
        alert('Only PNG and JPEG images are allowed');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
      }

      try {
        await uploadAvatar(token, file);
        alert('Avatar uploaded successfully!');
        (window as any).navigate('/dashboard');
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Avatar upload failed');
      } finally {
        avatarFileInput.value = '';
        avatarDropdown?.classList.add('hidden');
      }
    });
  }

  if (removeAvatarBtn) {
    removeAvatarBtn.addEventListener('click', async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        alert('Please log in to remove avatar');
        return;
      }

      if (!confirm('Are you sure you want to remove your avatar?')) {
        return;
      }

      try {
        const defaultAvatarResponse = await fetch('/avatars/default.png');
        const blob = await defaultAvatarResponse.blob();
        const file = new File([blob], 'default.png', { type: 'image/png' });

        await uploadAvatar(token, file);
        alert('Avatar removed successfully!');
        (window as any).navigate('/Dashboard');
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to remove avatar');
      } finally {
        avatarDropdown?.classList.add('hidden');
      }
    });
  }

  const profileForm = document.getElementById('profile-update-form');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const token = localStorage.getItem('access_token');
      if (!token) {
        alert('Please log in to update your profile');
        return;
      }

      const usernameInput = document.getElementById('username-input') as HTMLInputElement;
      const displayNameInput = document.getElementById('display-name-input') as HTMLInputElement;
      
      const username = usernameInput.value.trim();
      const display_name = displayNameInput.value.trim();

      if (!username && !display_name) {
        alert('Please enter at least one field to update');
        return;
      }

      if (username && (username.length < 3 || username.length > 20)) {
        alert('Username must be between 3 and 20 characters');
        return;
      }

      if (display_name && (display_name.length < 2 || display_name.length > 30)) {
        alert('Display name must be between 2 and 30 characters');
        return;
      }

      try {
        await updateProfile(token, { username, display_name });
        alert('Profile updated successfully!');
        (window as any).navigate('/dashboard');
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Profile update failed');
      }
    });
  }

  if (winLossChartBtn && winLossChart) {      
    winLossChartBtn.addEventListener('click', () => {
      winLossChart.classList.remove('hidden');
      winLossChartBtn.classList.add('active', 'bg-blue-600', 'text-white');
      winLossChartBtn.classList.remove('bg-gray-700', 'text-gray-300');
    });
  }

  // document.querySelectorAll('.recent-game-item').forEach(item => {
  //   item.addEventListener('click', (e) => {
  //     const gameId = item.getAttribute('data-game-id');
  //     const detailsElement = document.getElementById(`game-details-${gameId}`);
      
  //     document.querySelectorAll('[id^="game-details-"]').forEach(detail => {
  //       if (detail.id !== `game-details-${gameId}`) {
  //         detail.classList.add('hidden');
  //       }
  //     });
      
  //     if (detailsElement) {
  //       detailsElement.classList.toggle('hidden');
  //     }
  //   });
  // });

  document.querySelectorAll('.recent-game-item').forEach(item => {
  item.addEventListener('click', (e) => {
    const gameId = item.getAttribute('data-game-id');
    const detailsElement = document.getElementById(`game-details-${gameId}`);
    
    document.querySelectorAll('.recent-game-item').forEach(otherItem => {
      otherItem.setAttribute('data-expanded', 'false');
    });
    
    document.querySelectorAll('[id^="game-details-"]').forEach(detail => {
      if (detail.id !== `game-details-${gameId}`) {
        detail.classList.add('hidden');
      }
    });
    
    if (detailsElement) {
      const isNowExpanded = detailsElement.classList.toggle('hidden');
      
      if (!isNowExpanded) {
        item.setAttribute('data-expanded', 'true');
      } else {
        item.setAttribute('data-expanded', 'false');
      }
    }
  });
});

  // Tabs
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', (e) => {
      const tabId = (e.target as HTMLElement).id;
      const contentId = tabId.replace('-tab', '-content');
      
      document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active', 'border-b-2', 'border-blue-400', 'text-blue-400');
        btn.classList.add('text-gray-400');
      });
      (e.target as HTMLElement).classList.add('active', 'border-b-2', 'border-blue-400', 'text-blue-400');
      (e.target as HTMLElement).classList.remove('text-gray-400');
      
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
      });
      document.getElementById(contentId)?.classList.remove('hidden');
    });
  });

  // Friend search
  const searchInput = document.getElementById('friend-search');
  const searchBtn = document.getElementById('search-friend-btn');
  const searchResults = document.getElementById('search-results');

  if (searchInput && searchBtn && searchResults) {
    searchBtn.addEventListener('click', async () => {
      const query = (searchInput as HTMLInputElement).value.trim();
      if (query.length < 2) {
        alert('Please enter at least 2 characters');
        return;
      }

      try {
        const results = await searchUsers(query);
        if (results.users.length === 0) {
          searchResults.innerHTML = '<p class="text-gray-400">No users found</p>';
        } else {
          searchResults.innerHTML = results.users.map((user: { avatar_url: any; display_name: any; username: any; id: any; }) => `
            <div class="flex items-center justify-between p-2 bg-gray-800 rounded mb-2">
              <div class="flex items-center">
                <img src="${user.avatar_url}" class="w-8 h-8 rounded-full mr-3">
                <div>
                  <div class="font-semibold">${user.display_name}</div>
                  <div class="text-sm text-gray-400">@${user.username}</div>
                </div>
              </div>
              <button class="glass-button add-friend-btn bg-blue-600 px-3 py-1 rounded text-sm hover:bg-blue-700"
                      data-user-id="${user.id}">
                Add Friend
              </button>
            </div>
          `).join('');
        }
        searchResults.classList.remove('hidden');
      } catch (error) {
        console.error('Search error:', error);
        searchResults.innerHTML = '<p class="text-red-400">Search failed</p>';
        searchResults.classList.remove('hidden');
      }
    });

    searchResults.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('add-friend-btn')) {
        const userId = target.getAttribute('data-user-id');
        if (userId) {
          try {
            await sendFriendRequest(userId);
            alert('Friend request sent!');
            searchResults.classList.add('hidden');
            (searchInput as HTMLInputElement).value = '';
          } catch (error) {
            alert(error instanceof Error ? error.message : 'Failed to send friend request');
          }
        }
      }
    });
  }

  const friendsList = document.getElementById('friends-list');
  if (friendsList) {
    friendsList.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const userIdAttr = target.getAttribute('data-user-id');
      const userId = userIdAttr ? parseInt(userIdAttr, 10) : null;

      if (!userId) return;

      if (target.classList.contains('view-profile-btn')) {
        (window as any).navigate(`/profile/${userId}`);
      } else if (target.classList.contains('play-friend-btn')) {
        // const username = target.getAttribute('data-username');
        // if (confirm(`Invite ${username} to play a game?`)) {
          inviteFriendToGame(userId);
        // }
      } else if (target.classList.contains('remove-friend-btn')) {
        if (confirm('Are you sure you want to remove this friend?')) {
          try {
            await removeFriend(userId);
            refreshFriendsList();
          } catch (error) {
            alert('Failed to remove friend');
          }
        }
      }
    });
  }
  loadPendingRequests();
  setupInlineEdit();
}

async function loadPendingRequests() {
  try {
    const requests = await getFriendRequests();
    const container = document.getElementById('pending-requests');
    if (container) {
      if (requests.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center py-4">No pending requests</p>';
      } else {
        container.innerHTML = requests.map(request => `
          <div class="glass-card flex items-center justify-between p-3 bg-gray-800 rounded">
            <div class="flex items-center">
              <img src="${request.avatar_url}" class="w-10 h-10 rounded-full mr-3">
              <div>
                <div class="font-semibold">${request.display_name}</div>
                <div class="text-sm text-gray-400">@${request.username}</div>
                <div class="text-xs text-gray-500">${new Date(request.created_at).toLocaleDateString()}</div>
              </div>
            </div>
            <div class="flex gap-2">
              <button class="glass-button accept-request-btn bg-green-600 px-3 py-1 rounded text-sm hover:bg-green-700"
                      data-request-id="${request.id}">
                Accept
              </button>
              <button class="glass-button reject-request-btn bg-red-600 px-3 py-1 rounded text-sm hover:bg-red-700"
                      data-request-id="${request.id}">
                Reject
              </button>
            </div>
          </div>
        `).join('');
      }
    container.querySelectorAll('.accept-request-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const requestId = btn.getAttribute('data-request-id');
          if (requestId) {
            try {
              await acceptFriendRequest(requestId);
              loadPendingRequests();
              refreshFriendsList();
            } catch (error) {
              alert('Failed to accept friend request');
            }
          }
        });
      });
      container.querySelectorAll('.reject-request-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const requestId = btn.getAttribute('data-request-id');
          if (requestId) {
            try {
              await rejectFriendRequest(requestId);
              loadPendingRequests();
            } catch (error) {
              alert('Failed to reject friend request');
            }
          }
        });
      });
    }
  } catch (error) {
    console.error('Failed to load pending requests:', error);
  }
}

function setupInlineEdit() {
  const editDisplayName = document.getElementById('edit-display-name');
  const editUsername = document.getElementById('edit-username');

  if (editDisplayName) {
    editDisplayName.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const textElement = document.getElementById('display-name-text');
      if (!textElement) 
        return;
      const currentValue = textElement.textContent;
      
      const input = document.createElement('input');
      input.type = 'text';
      input.value = currentValue;
      input.className = 'bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-2xl font-bold focus:outline-none focus:border-purple-500';
      
      textElement.style.display = 'none';
      textElement.parentNode?.insertBefore(input, textElement);
      input.focus();
      input.select();

      let isSavedOrCancelled = false;
      
      const save = async () => {
        if (isSavedOrCancelled) return;
          isSavedOrCancelled = true;
        const newValue = input.value.trim();
        
        if (!newValue) {
          alert('Display name cannot be empty');
          input.focus();
          isSavedOrCancelled = false;
          return;
        }
        
        if (newValue.length < 2 || newValue.length > 30) {
          alert('Display name must be between 2 and 30 characters');
          input.focus();
          isSavedOrCancelled = false;
          return;
        }
        
        if (newValue === currentValue) {
          input.remove();
          textElement.style.display = 'inline';
          return;
        }
        
        try {
          const token = localStorage.getItem('access_token');
          if (!token) {
            alert('Please log in first');
            return;
          }
          await updateProfile(token, { display_name: newValue });
          
          textElement.textContent = newValue;
          input.remove();
          textElement.style.display = 'inline';
          
          const successMsg = document.createElement('span');
          successMsg.textContent = ' ✓';
          successMsg.className = 'text-green-400';
          textElement.appendChild(successMsg);
          setTimeout(() => successMsg.remove(), 2000);
          
        } catch (error) {
          alert(error instanceof Error ? error.message : 'Update failed');
        } finally {
          input.removeEventListener('blur', save);
        }
      };
      
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          save();
        } else if (e.key === 'Escape') {
          input.remove();
          textElement.style.display = 'inline';
        }
      });
      
      input.addEventListener('blur', save);
    });
  }

  if (editUsername) {
    editUsername.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const textElement = document.getElementById('username-text');
      if (!textElement)
        return ;
      const currentValue = textElement.textContent.replace('@', '');
      
      const input = document.createElement('input');
      input.type = 'text';
      input.value = currentValue;
      input.className = 'bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white focus:outline-none focus:border-purple-500';
      
      textElement.style.display = 'none';
      textElement.parentNode?.insertBefore(input, textElement);
      input.focus();
      input.select();
      
      const save = async () => {
        const newValue = input.value.trim();
        
        if (!newValue) {
          alert('Username cannot be empty');
          return;
        }
        
        if (newValue.length < 3 || newValue.length > 20) {
          alert('Username must be between 3 and 20 characters');
          return;
        }
        
        if (newValue === currentValue) {
          input.remove();
          textElement.style.display = 'inline';
          return;
        }
        
        try {
          const token = localStorage.getItem('access_token');
          if (!token) {
            alert('Please log in first');
            return;
          }
          await updateProfile(token, { username: newValue });
          
          textElement.textContent = `@${newValue}`;
          input.remove();
          textElement.style.display = 'inline';
          
          const successMsg = document.createElement('span');
          successMsg.textContent = ' ✓';
          successMsg.className = 'text-green-400';
          textElement.appendChild(successMsg);
          setTimeout(() => successMsg.remove(), 2000);
          
        } catch (error) {
          alert(error instanceof Error ? error.message : 'Update failed');
        }
      };
      
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          save();
        } else if (e.key === 'Escape') {
          input.remove();
          textElement.style.display = 'inline';
        }
      });
      
      input.addEventListener('blur', save);
    });
  }
}
