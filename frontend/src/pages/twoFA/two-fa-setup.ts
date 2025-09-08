import { setup2FA, enable2FA } from '../../services';

export async function twoFASetupPage(): Promise<string> {
  const token = localStorage.getItem('access_token');
  if (!token) {
    (window as any).navigate('/');
    return '';
  }
  
  try {
    const setupData = await setup2FA(token);
    return `
      <div class="glass-card max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
        <h2 class="text-2xl mb-4">Setup 2FA</h2>
        <p class="mb-4">Scan this QR code with your authenticator app:</p>
        <div class="bg-white p-4 rounded-lg mb-4 text-center">
          <img src="${setupData.qr_code}" alt="2FA QR Code" class="w-48 h-48 mx-auto">
        </div>
        <p class="mb-4 text-sm">Or enter this secret manually in your app:</p>
        <p class="mb-4 text-sm flex items-center space-x-2">
          <span class="truncate bg-gray-700 px-2 py-1 rounded flex-1" id="secret-text">
            ${setupData.secret}
          </span>
          <button id="copy-secret" class="text-green-400">
            📋
          </button>
        </p>
        <input type="text" id="2fa-code" placeholder="Enter verification code" class="w-full p-2 bg-gray-700 rounded" maxlength="6" pattern="[0-9]{6}" required>
        <button id="enable-2fa" class="w-full bg-blue-500 p-2 rounded mt-2">Enable 2FA</button>
        <div class="mt-4 text-center">
          <button onclick="navigate('/')" class="text-gray-400 hover:underline">Cancel</button>
        </div>
      </div>
    `;
  } catch (error) {
    return `
      <div class="max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
        <h2 class="text-2xl mb-4">2FA Setup Error</h2>
        <p class="text-red-400 mb-4">${error instanceof Error ? error.message : 'Failed to setup 2FA'}</p>
        <button onclick="navigate('/')" class="w-full bg-blue-500 p-2 rounded">Back to Dashboard</button>
      </div>
    `;
  }
}

export function attach2FASetupListeners() {
  const enable2FABtn = document.getElementById('enable-2fa');
  if (enable2FABtn) {
    enable2FABtn.addEventListener('click', async () => {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const code = (document.getElementById('2fa-code') as HTMLInputElement).value;
      if (!code) {
        alert('Please enter a 2FA code');
        return;
      }

      try {
        await enable2FA(token, code);
        alert('2FA enabled successfully!');
        (window as any).navigate('/');
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to enable 2FA');
      }
    });
  }

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.id === 'copy-secret') {
      const secretEl = document.getElementById('secret-text') as HTMLElement;
      if (!secretEl) return;
      
      navigator.clipboard.writeText((secretEl.textContent || '').trim()).then(() => {
        const original = target.textContent;
        target.textContent = '✔';
        setTimeout(() => {
          target.textContent = original;
        }, 2000);
      });
    }
  });
}
