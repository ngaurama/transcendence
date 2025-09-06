import { resetPassword } from '../../services';

export async function resetPasswordPage(): Promise<string> {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  
  if (!token) {
    return `
      <div class="max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
        <h2 class="text-2xl mb-4 text-red-400">Invalid Reset Link</h2>
        <p class="mb-4">The password reset link is invalid or missing.</p>
        <button onclick="navigate('/forgot-password')" class="glass-button w-full bg-blue-500 p-2 rounded mb-2">
          Request New Reset Link
        </button>
        <button onclick="navigate('/login')" class="glass-button w-full bg-gray-500 p-2 rounded">
          Back to Login
        </button>
      </div>
    `;
  }
  
  try {
    const res = await fetch(`/api/auth/validate-reset-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();
    if (!res.ok || !data.valid) {
      return `
        <div class="max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
          <h2 class="text-2xl mb-4 text-red-400">Invalid or Expired Reset Token</h2>
          <p class="mb-4">The password reset link is invalid or has expired. Please request a new one.</p>
          <button onclick="navigate('/forgot-password')" class="glass-button w-full bg-blue-500 p-2 rounded mb-2">
            Request New Reset Link
          </button>
          <button onclick="navigate('/login')" class="glass-button w-full bg-gray-500 p-2 rounded">
            Back to Login
          </button>
        </div>
      `;
    }
    return `
      <div class="max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
        <h2 class="text-2xl mb-4">Reset Password</h2>
        <div id="reset-error" class="hidden mb-4 p-3 bg-red-600 text-white rounded"></div>
        <div id="reset-success" class="hidden mb-4 p-3 bg-green-600 text-white rounded">
          <h3 class="font-bold mb-2">Password Reset Successfully!</h3>
          <p>Your password has been reset. You can now login with your new password.</p>
          <div class="mt-4">
            <button onclick="navigate('/login')" class="glass-button w-full bg-blue-500 p-2 rounded">Go to Login</button>
          </div>
        </div>
        <form id="reset-password-form" class="space-y-4">
          <input type="hidden" id="reset-token" value="${token}">
          <p class="text-sm text-gray-400 mb-4">
            Enter your new password below.
          </p>
          <input type="password" id="new-password" placeholder="New Password" class="w-full p-2 bg-gray-700 rounded" minlength="6" required>
          <input type="password" id="confirm-password" placeholder="Confirm New Password" class="w-full p-2 bg-gray-700 rounded" minlength="6" required>
          <button type="submit" class="glass-button w-full bg-blue-500 p-2 rounded">Reset Password</button>
        </form>
        <div class="mt-4 text-center">
          <a href="#" onclick="navigate('/login')" class="text-blue-400 hover:underline">Back to Login</a>
        </div>
      </div>
    `;
  } catch (error) {
    return `
      <div class="max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
        <h2 class="text-2xl mb-4 text-red-400">Reset Token Validation Error</h2>
        <p class="mb-4">Failed to validate reset token. Please try again later.</p>
        <button onclick="navigate('/forgot-password')" class="glass-button w-full bg-blue-500 p-2 rounded mb-2">
          Request New Reset Link
        </button>
        <button onclick="navigate('/login')" class="glass-button w-full bg-gray-500 p-2 rounded">
          Back to Login
        </button>
      </div>
    `;
  }
}

export function attachResetPasswordListeners() {
    const resetPasswordForm = document.getElementById('reset-password-form');
    if (resetPasswordForm) {
      resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = (document.getElementById('reset-token') as HTMLInputElement).value;
        const newPassword = (document.getElementById('new-password') as HTMLInputElement).value;
        const confirmPassword = (document.getElementById('confirm-password') as HTMLInputElement).value;

        if (newPassword !== confirmPassword) {
          const errorDiv = document.getElementById('reset-error');
          if (errorDiv) {
            errorDiv.textContent = 'Passwords do not match';
            errorDiv.classList.remove('hidden');
          } else {
            alert('Passwords do not match');
          }
          return;
        }

        if (!token) {
          alert('Invalid reset token');
          return;
        }

        try {
          await resetPassword(token, newPassword);
          const successDiv = document.getElementById('reset-success');
          const form = document.getElementById('reset-password-form');
          if (successDiv && form) {
            form.style.display = 'none';
            successDiv.classList.remove('hidden');
          } else {
            alert('Password has been reset successfully');
            (window as any).navigate('/login');
          }
        } catch (error) {
          const errorDiv = document.getElementById('reset-error');
          if (errorDiv) {
            errorDiv.textContent = error instanceof Error ? error.message : 'Failed to reset password';
            errorDiv.classList.remove('hidden');
          } else {
            alert(error instanceof Error ? error.message : 'Failed to reset password');
          }
        }
      });
    }
}