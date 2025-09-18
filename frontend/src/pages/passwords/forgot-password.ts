import { forgotPassword } from '../../services';
import { showSMTPFallbackNotification } from '../../services/EmailService';

export function forgotPasswordPage(): string {
  return `
    <div class="glass-card max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
      <h2 class="text-2xl mb-4">Forgot Password</h2>
      <div id="forgot-error" class="hidden mb-4 p-3 bg-red-600 text-white rounded"></div>
      <div id="forgot-success" class="hidden mb-4 p-3 bg-green-600 text-white rounded">
        <h3 class="font-bold mb-2">Reset Instructions Sent!</h3>
        <p>Password reset instructions have been sent to your email address. Please check your inbox and follow the link to reset your password.</p>
        <div class="mt-4">
          <button onclick="navigate('/login')" class="glass-button w-full bg-blue-500 p-2 rounded">Back to Login</button>
        </div>
      </div>
      <form id="forgot-password-form" class="space-y-4">
        <p class="text-sm text-gray-400 mb-4">
          Enter your email address and we'll send you instructions to reset your password.
        </p>
        <input type="email" id="forgot-email" placeholder="Email Address" class="w-full p-2 bg-gray-700 rounded" required>
        <button type="submit" class="glass-button w-full bg-blue-500 p-2 rounded">Send Reset Instructions</button>
      </form>
      <div class="mt-4 text-center">
        <a href="#" onclick="navigate('/login')" class="text-blue-400 hover:underline">Back to Login</a>
      </div>
    </div>
  `;
}

export function attachForgotPasswordListeners() {
  const forgotPasswordForm = document.getElementById('forgot-password-form');
  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (document.getElementById('forgot-email') as HTMLInputElement).value;

      try {
        const result = await forgotPassword(email);
        
        if (result.smtp_fallback && result.reset_token) {
          showSMTPFallbackNotification(result.reset_token, 'reset');
        }
        
        const successDiv = document.getElementById('forgot-success');
        const form = document.getElementById('forgot-password-form');
        if (successDiv && form) {
          form.style.display = 'none';
          successDiv.classList.remove('hidden');
        } else {
          alert('Password reset instructions have been sent to your email');
        }
      } catch (error) {
        const errorDiv = document.getElementById('forgot-error');
        if (errorDiv) {
          errorDiv.textContent = error instanceof Error ? error.message : 'Failed to send reset instructions';
          errorDiv.classList.remove('hidden');
        } else {
          alert(error instanceof Error ? error.message : 'Failed to send reset instructions');
        }
      }
    });
  }
}
