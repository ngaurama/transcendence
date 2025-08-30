// pages/settings.ts
import { checkAuthStatus, uploadAvatar, getUserStats } from '../services';

export async function settingsPage(): Promise<string> {
  const user = await checkAuthStatus();
  if (!user) {
    (window as any).navigate('/login');
    return '';
  }

  const stats = await getUserStats();

  const isOAuthUser = user.oauth_provider && user.oauth_provider !== 'local';
  return `
    <div class="max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
      <h2 class="text-2xl mb-4">Settings</h2>
      ${user.oauth_provider
        ? `<p class="mb-2 text-sm text-gray-400">Connected via ${user.oauth_provider}</p>`
        : ''
      }
      <img src="${user.avatar_url}" alt="Avatar" class="w-32 h-32 rounded-full mx-auto mb-4">
      <p class="mb-2">Username: ${user.username}</p>
      <p class="mb-4">Email: ${user.email}</p>
      <div class="mb-4">
        <label class="block mb-2">Change Avatar:</label>
        <input type="file" id="avatar-upload" accept="image/png,image/jpeg" class="w-full p-2 bg-gray-700 rounded">
        <button id="upload-avatar-btn" class="w-full bg-purple-500 p-2 rounded mt-2">Upload Avatar</button>
      </div>
      
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
  const uploadAvatarBtn = document.getElementById('upload-avatar-btn');
  if (uploadAvatarBtn) {
    uploadAvatarBtn.addEventListener('click', async () => {
      const token = localStorage.getItem('access_token');
      const fileInput = document.getElementById('avatar-upload') as HTMLInputElement;
      const file = fileInput?.files?.[0];

      if (!token || !file) {
        alert('Please select a file and ensure you are logged in');
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
      }
    });
  }
}
