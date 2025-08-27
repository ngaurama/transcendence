import {verify2FACode } from '../../services';

export function verify2FAPage(): string {
  return `
    <div class="max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
      <h2 class="text-2xl mb-4">Verify 2FA Code</h2>
      <p class="mb-4 text-gray-300">Please enter the 6-digit code from your authenticator app.</p>
      <form id="verify-2fa-form" class="space-y-4">
        <input type="text" id="2fa-verify-code" placeholder="Enter 6-digit code" class="w-full p-2 bg-gray-700 rounded" maxlength="6" pattern="[0-9]{6}" required>
        <button type="submit" class="w-full bg-blue-500 p-2 rounded">Verify Code</button>
      </form>
      <div class="mt-4 text-center">
        <button onclick="navigate('/login')" class="text-gray-400 hover:underline">Back to Login</button>
      </div>
    </div>
  `;
}

export function attachVerify2FAListeners() {
    const verify2FAForm = document.getElementById('verify-2fa-form');
    if (verify2FAForm) {
        verify2FAForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = (document.getElementById('2fa-verify-code') as HTMLInputElement).value;

        try {
            await verify2FACode(code);
            (window as any).navigate('/');
        } catch (error) {
            alert(error instanceof Error ? error.message : '2FA verification failed');
        }
        });
    }
}
