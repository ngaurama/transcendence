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
    <div class="glass-card max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
      <h2 class="text-2xl mb-4">Login</h2>
      ${messageHtml}
      <div id="login-error" class="hidden mb-4 p-3 bg-red-600 text-white rounded"></div>
      <form id="login-form" class="space-y-4">
        <input type="text" class="glass-input" id="username" placeholder="Username or Email" class="w-full p-2 bg-gray-700 rounded" required>
        <input type="password" class="glass-input" id="password" placeholder="Password" class="w-full p-2 bg-gray-700 rounded" required>
        <button type="submit" class="w-full bg-blue-500 p-2 rounded">Login</button>
      </form>
      <div class="mt-4 text-center">
        <a href="#" onclick="navigate('/forgot-password')" class="text-blue-400 hover:underline">Forgot Password?</a>
      </div>
      <div class="mt-4">
      ${window.location.hostname === 'localhost' ? `
        <p class="text-center mb-2">Or login with:</p>
        <div class="flex justify-evenly">
          <div class="flex justify-center gap-6">
            <button id="google-oauth" class="bg-blue-500/50 w-16 h-16 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 533.5 544.3" class="w-8 h-8">
                <path fill="#4285F4" d="M533.5 278.4c0-17.3-1.4-34-4.1-50.3H272.1v95h147.2c-6.3 33.8-25.1 62.5-53.5 81.7v67h86.4c50.6-46.6 81.3-115.2 81.3-193.4z"/>
                <path fill="#34A853" d="M272.1 544.3c72.4 0 133.3-23.9 177.8-64.8l-86.4-67c-24.1 16.2-55 25.7-91.4 25.7-70.2 0-129.7-47.5-151-111.3h-89.6v69.8c44.8 88.3 136.7 148.6 240.6 148.6z"/>
                <path fill="#FBBC05" d="M121.5 324.7c-10.3-30.3-10.3-62.7 0-93l-89.6-69.8C7.6 203.2 0 239.3 0 272.1s7.6 68.9 31.9 110.2l89.6-69.8z"/>
                <path fill="#EA4335" d="M272.1 107.6c39.3-.6 76.8 14.2 105.7 41.1l79.4-79.4C404.8 24.2 343.9 0 272.1 0 168.2 0 76.3 60.3 31.5 148.6l89.6 69.8c21.3-63.8 80.8-111.3 151-111.3z"/>
              </svg>
            </button>

            <button id="github-oauth" class="bg-gray-700 w-16 h-16 rounded-full flex items-center justify-center hover:bg-gray-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-8 h-8 fill-white">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.087-.744.083-.729.083-.729 1.205.085 1.838 1.237 1.838 1.237 1.07 1.835 2.809 1.305 3.495.998.108-.776.418-1.305.762-1.605-2.665-.3-5.466-1.333-5.466-5.931 0-1.31.467-2.381 1.235-3.221-.123-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.301 1.23a11.5 11.5 0 0 1 3.003-.404c1.018.004 2.042.138 3.003.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.241 2.873.118 3.176.77.84 1.232 1.911 1.232 3.221 0 4.609-2.803 5.628-5.475 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.898-.015 3.293 0 .319.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
              </svg>
            </button>

            <button id="fortytwo-oauth" class="bg-white w-16 h-16 rounded-full flex items-center justify-center hover:bg-gray-200">
              <img src="/fortytwo.png" alt="42 Logo" class="w-10 h-10 object-contain">
            </button>
          </div>
        </div>
      </div>
      ` : ''}
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

  const fortytwoOAuthBtn = document.getElementById('fortytwo-oauth');
  if (fortytwoOAuthBtn) {
    fortytwoOAuthBtn.addEventListener('click', () => initiateOAuth('fortytwo'));
  }
}
