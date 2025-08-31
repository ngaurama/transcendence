// pages/settings.ts
import { checkAuthStatus, uploadAvatar, getUserStats, updateProfile } from '../services';

export async function settingsPage(): Promise<string> {
  const user = await checkAuthStatus();
  if (!user) {
    (window as any).navigate('/login');
    return '';
  }

  const stats = await getUserStats();
  const isOAuthUser = user.oauth_provider && user.oauth_provider !== 'local';
  const isDefaultAvatar = user.avatar_url === '/avatars/default.png';

  return `
    <div class="max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
      <h2 class="text-2xl mb-4">Settings</h2>
      ${user.oauth_provider
        ? `<p class="mb-2 text-sm text-gray-400">Connected via ${user.oauth_provider}</p>`
        : ''
      }
      
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
            class="block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-600"
          >
            Upload new avatar
          </button>
          ${!isDefaultAvatar ? `
            <button 
              id="remove-avatar-btn" 
              class="block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-600"
            >
              Remove avatar
            </button>
          ` : ''}
        </div>
      </div>
    </div>

      
      <!-- Profile Update Form -->
      <form id="profile-update-form" class="mb-6">
        <div class="mb-4">
          <label class="block mb-2 text-sm font-medium">Username:</label>
          <input 
            type="text" 
            id="username-input" 
            value="${user.username || ''}" 
            class="w-full p-2 bg-gray-700 rounded border border-gray-600"
            ${isOAuthUser ? 'disabled' : ''}
            placeholder="${isOAuthUser ? 'Managed by OAuth provider' : 'Enter username'}"
          >
        </div>
        
        <div class="mb-4">
          <label class="block mb-2 text-sm font-medium">Display Name:</label>
          <input 
            type="text" 
            id="display-name-input" 
            value="${user.display_name || ''}" 
            class="w-full p-2 bg-gray-700 rounded border border-gray-600"
            placeholder="Enter display name"
          >
        </div>
        
        <button 
          type="submit" 
          class="w-full bg-green-600 p-2 rounded hover:bg-green-700 transition-colors"
          ${isOAuthUser ? 'disabled' : ''}
        >
          Update Profile
        </button>
      </form>
      
      <div class="mb-4">
        <h3 class="text-xl mb-2">Game Statistics</h3>
        <p>Games Played: ${stats.games_played || 0}</p>
        <p>Games Won: ${stats.games_won || 0}</p>
        <p>Games Lost: ${stats.games_lost || 0}</p>
        <p>Wins with Powerups: ${stats.wins_with_powerups || 0}</p>
        <p>Wins without Powerups: ${stats.wins_without_powerups || 0}</p>
        <p>Most Wins Variant: ${stats.most_wins_variant?.variant || 'None'}</p>
        <p>Tournaments Created: ${stats.tournaments_created || 0}</p>
        <p>Tournaments Played: ${stats.tournaments_played || 0}</p>
        <p>Tournaments Won: ${stats.tournaments_won || 0}</p>
      </div>

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
          Account management is handled through ${user.oauth_provider}.
        </p>
      `}
    </div>
  `;
}

export function attachSettingsListeners() {
  const avatarTrigger = document.getElementById('avatar-trigger');
  const avatarDropdown = document.getElementById('avatar-dropdown');
  const avatarFileInput = document.getElementById('avatar-file-input') as HTMLInputElement;
  const removeAvatarBtn = document.getElementById('remove-avatar-btn');

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
        (window as any).navigate('/settings');
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
        (window as any).navigate('/settings');
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
        (window as any).navigate('/settings');
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Profile update failed');
      }
    });
  }
}
