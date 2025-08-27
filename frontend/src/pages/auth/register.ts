import { register, initiateOAuth } from '../../services';

export function registerPage(): string {
  return `
    <div class="max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
      <h2 class="text-2xl mb-4">Register</h2>
      <div id="register-error" class="hidden mb-4 p-3 bg-red-600 text-white rounded"></div>
      <form id="register-form" class="space-y-4">
        <input type="text" id="reg-username" placeholder="Username" class="w-full p-2 bg-gray-700 rounded" minlength="3" required>
        <input type="email" id="reg-email" placeholder="Email" class="w-full p-2 bg-gray-700 rounded" required>
        <input type="password" id="reg-password" placeholder="Password" class="w-full p-2 bg-gray-700 rounded" minlength="6" required>
        <input type="text" id="reg-display-name" placeholder="Display Name" class="w-full p-2 bg-gray-700 rounded" minlength="2" required>
        <label class="flex items-center">
          <input type="checkbox" id="accept-gdpr" class="mr-2" required> I accept the GDPR terms and conditions
        </label>
        <button type="submit" class="w-full bg-green-500 p-2 rounded">Register</button>
      </form>
      <div class="mt-4">
        <p class="text-center mb-2">Or sign up with:</p>
        <button id="google-oauth" class="w-full bg-red-500 p-2 rounded mb-2">Google</button>
        <button id="github-oauth" class="w-full bg-gray-700 p-2 rounded">GitHub</button>
      </div>
      <div class="mt-4 text-center">
        <span class="text-gray-400">Already have an account? </span>
        <a href="#" onclick="navigate('/login')" class="text-blue-400 hover:underline">Sign in</a>
      </div>
    </div>
  `;
}

export function attachRegisterListeners() {
const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = (document.getElementById('reg-username') as HTMLInputElement).value;
        const email = (document.getElementById('reg-email') as HTMLInputElement).value;
        const password = (document.getElementById('reg-password') as HTMLInputElement).value;
        const displayName = (document.getElementById('reg-display-name') as HTMLInputElement).value;
        const acceptGdpr = (document.getElementById('accept-gdpr') as HTMLInputElement).checked;

        try {
          await register(username, email, password, displayName, acceptGdpr);
          (window as any).navigate('/');
        } catch (error) {
          const errorDiv = document.getElementById('register-error');
          if (errorDiv) {
            errorDiv.textContent = error instanceof Error ? error.message : 'Registration failed';
            errorDiv.classList.remove('hidden');
          } else {
            alert(error instanceof Error ? error.message : 'Registration failed');
          }
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
