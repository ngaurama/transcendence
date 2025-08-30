// router.ts
import { checkAuthStatus } from '../services';
import * as Pages from '../pages';

export function initRouter() {
  const app = document.getElementById('app') as HTMLElement;
  const authStatus = document.getElementById('auth-status') as HTMLElement;

  const routes: { [key: string]: () => Promise<string> | string } = {
    '/': Pages.homePage,
    '/settings': Pages.settingsPage,
    '/play': Pages.playSelectionPage,
    '/game/pong': Pages.pongGamePage,
    '/tournaments': Pages.tournamentSelectionPage,
    '/tournament/:tournamentId': Pages.tournamentPage,
    '/login': Pages.loginPage,
    '/register': Pages.registerPage,
    '/verify-email': Pages.verifyEmailPage,
    '/2fa-setup': Pages.twoFASetupPage,
    '/verify-2fa': Pages.verify2FAPage,
    '/forgot-password': Pages.forgotPasswordPage,
    '/reset-password': Pages.resetPasswordPage,
    '/change-password': Pages.changePasswordPage,
    '/logout': Pages.logoutPage,
    '/auth/callback': Pages.authCallbackPage,
  };

  async function render() {
    let path = window.location.pathname;
    // Handle dynamic routes
    const tournamentMatch = path.match(/^\/tournament\/(\d+)$/);
    if (tournamentMatch) {
      path = '/tournament/:tournamentId';
      (window as any).tournamentId = tournamentMatch[1];
    }

    const content = await routes[path]?.() || '<h2>404 - Page Not Found</h2>';
    app.innerHTML = content;
    updateAuthStatus();
    attachEventListeners();
  }

  async function updateAuthStatus() {
    const user = await checkAuthStatus();
    if (user) {
      if (user.is_guest) {
        authStatus.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="text-m text-white">Guest: ${user.display_name}</span>
            <button onclick="navigate('/logout')" class="bg-red-800 px-2 py-1 rounded text-sm">Logout</button>
          </div>
        `;
      } else {
        authStatus.innerHTML = `
          <div class="relative">
            <img src="${user.avatar_url}" alt="Avatar" class="w-10 h-10 rounded-full cursor-pointer" id="avatar-dropdown-trigger">
            <div id="avatar-dropdown" class="hidden dropdown-menu">
              <div class="dropdown-item" onclick="navigate('/settings')">Settings</div>
              <div class="dropdown-item" onclick="navigate('/tournaments')">Tournaments</div>
              <div class="dropdown-item hover:bg-red-500" onclick="navigate('/logout')">Logout</div>
            </div>
          </div>
        `;
        attachDropdownListener();
      }
    } else {
      authStatus.innerHTML = `
        <button onclick="navigate('/login')" class="bg-blue-500 px-3 py-1 rounded mr-2">Login</button>
        <button onclick="navigate('/register')" class="bg-green-500 px-3 py-1 rounded">Register</button>
      `;
    }
  }

  function attachDropdownListener() {
    const trigger = document.getElementById('avatar-dropdown-trigger');
    const menu = document.getElementById('avatar-dropdown');
    if (trigger && menu) {
      trigger.addEventListener('click', () => menu.classList.toggle('hidden'));
      document.addEventListener('click', (e) => {
        if (!trigger.contains(e.target as Node)) menu.classList.add('hidden');
      }, { once: true });
    }
  }

  function attachEventListeners() {
    const currentPath = window.location.pathname;
    const tournamentMatch = currentPath.match(/^\/tournament\/(\d+)$/);
    if (tournamentMatch) {
      Pages.attachTournamentListeners(tournamentMatch[1]);
    } else {
      switch (currentPath) {
        case '/': Pages.attachHomeListeners(); break;
        case '/settings': Pages.attachSettingsListeners(); break;
        case '/play': Pages.attachPlaySelectionListeners(); break;
        case '/game/pong': Pages.attachPongGameListeners(); break;
        case '/tournaments': Pages.attachTournamentSelectionListeners(); break;
        case '/login': Pages.attachLoginListeners(); break;
        case '/register': Pages.attachRegisterListeners(); break;
        case '/verify-2fa': Pages.attachVerify2FAListeners(); break;
        case '/2fa-setup': Pages.attach2FASetupListeners(); break;
        case '/forgot-password': Pages.attachForgotPasswordListeners(); break;
        case '/reset-password': Pages.attachResetPasswordListeners(); break;
        case '/change-password': Pages.attachChangePasswordListeners(); break;
      }
    }
  }

  window.addEventListener('popstate', render);
  render();
}
