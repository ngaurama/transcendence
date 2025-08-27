import { login, initiateOAuth, guestLogin } from '../../services';
import {  } from '../../utils/constants';

export function loginPage(): string {
  const urlParams = new URLSearchParams(window.location.search);
  const message = urlParams.get('message');
  
  let messageHtml = '';
  if (message === 'email_verified') {
    messageHtml = `
      <div class="mb-4 p-3 bg-green-600 text-white rounded">
        Email verified successfully! You can now login.
      </div>
    `;
  }
  
  return `
    <div class="max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
      <h2 class="text-2xl mb-4">Login</h2>
      ${messageHtml}
      <div id="login-error" class="hidden mb-4 p-3 bg-red-600 text-white rounded"></div>
      <form id="login-form" class="space-y-4">
        <input type="text" id="username" placeholder="Username or Email" class="w-full p-2 bg-gray-700 rounded" required>
        <input type="password" id="password" placeholder="Password" class="w-full p-2 bg-gray-700 rounded" required>
        <button type="submit" class="w-full bg-blue-500 p-2 rounded">Login</button>
      </form>
      <div class="mt-4 text-center">
        <a href="#" onclick="navigate('/forgot-password')" class="text-blue-400 hover:underline">Forgot Password?</a>
      </div>
      <div class="mt-4">
        <p class="text-center mb-2">Or login with:</p>
        <button id="google-oauth" class="w-full bg-red-500 p-2 rounded mb-2">Google</button>
        <button id="github-oauth" class="w-full bg-gray-700 p-2 rounded">GitHub</button>
      </div>
      <div class="mt-4 text-center">
        <button id="guest-login" class="text-blue-400 hover:underline">Play as Guest</button>
      </div>
      <div class="mt-4 text-center">
        <span class="text-gray-400">Don't have an account? </span>
        <a href="#" onclick="navigate('/register')" class="text-green-400 hover:underline">Sign up</a>
      </div>
    </div>
  `;
}

export function attachLoginListeners() {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = (document.getElementById('username') as HTMLInputElement).value;
      const password = (document.getElementById('password') as HTMLInputElement).value;

      try {
        const result = await login(username, password);
        if (result.requires2FA) {
          (window as any).navigate('/verify-2fa');
        } else {
          (window as any).navigate('/');
        }
      } catch (error) {
        const errorDiv = document.getElementById('login-error');
        if (errorDiv) {
          errorDiv.textContent = error instanceof Error ? error.message : 'Login failed';
          errorDiv.classList.remove('hidden');
        } else {
          alert(error instanceof Error ? error.message : 'Login failed');
        }
      }
    });
  }

  const guestBtn = document.getElementById('guest-login');
  if (guestBtn) {
    guestBtn.addEventListener('click', async () => {
      const alias = prompt('Enter your guest alias:');
      if (!alias) return;

      try {
        const result = await guestLogin(alias);
        localStorage.setItem('access_token', result.access_token);
        localStorage.setItem('refresh_token', result.refresh_token);
        (window as any).navigate('/');
      } catch (error) {
        alert('Guest login failed');
      }
    });
  }

  const googleOAuthBtn = document.getElementById('google-oauth');
  if (googleOAuthBtn) {
    googleOAuthBtn.addEventListener('click', () => initiateOAuth('google'));
  }

  const githubOAuthBtn = document.getElementById('github-oauth');
  if (githubOAuthBtn) {
    githubOAuthBtn.addEventListener('click', () => initiateOAuth('github'));
  }
}
