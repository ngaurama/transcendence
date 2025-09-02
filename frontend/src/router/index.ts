// router.ts
import { checkAuthStatus } from '../services';
import * as Pages from '../pages';

// Define routes once
const routes: { [key: string]: () => Promise<string> | string } = {
  '/': Pages.homePage,
  '/dashboard': Pages.dashboardPage,
  '/profile/:userId': Pages.profilePage,
  '/play': Pages.playSelectionPage,
  '/game/pong': Pages.pongGamePage,
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
  '/gdpr': Pages.gdprPage,
  '/view-data': Pages.viewDataPage,
  '/export-data': Pages.exportDataPage,
  '/anonymize-account': Pages.anonymizeAccountPage,
  '/delete-account': Pages.deleteAccountPage,
};

// Cache DOM elements
const app = document.getElementById('app') as HTMLElement;
const authStatus = document.getElementById('auth-status') as HTMLElement;

export function initRouter() {
  // Set up the popstate event listener once
  window.addEventListener('popstate', render);
  // Perform initial render
  render();
}

export async function render() {
  let path = window.location.pathname;

  const profileMatch = path.match(/^\/profile\/(\d+)$/);
  if (profileMatch) {
    path = '/profile/:userId';
    (window as any).profileUserId = profileMatch[1];
  }

  const tournamentMatch = path.match(/^\/tournament\/(\d+)$/);
  if (tournamentMatch) {
    path = '/tournament/:tournamentId';
    (window as any).tournamentId = tournamentMatch[1];
  }
  try {
    const result = await routes[path]?.();
    let content = result || '<h2>404 - Page Not Found</h2>';

    app.innerHTML = content;
    updateAuthStatus();
    attachEventListeners();
  } catch (err) {
    console.error("Render error:", err);
    app.innerHTML = '<h2>Error rendering page</h2>';
  }
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
            <div class="dropdown-item" onclick="navigate('/dashboard')">Dashboard</div>
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
  const profileMatch = currentPath.match(/^\/profile\/(\d+)$/);
  if (profileMatch) {
    Pages.attachProfileListeners(profileMatch[1]);
    return;
  }

  const tournamentMatch = currentPath.match(/^\/tournament\/(\d+)$/);
  if (tournamentMatch) {
    Pages.attachTournamentListeners(tournamentMatch[1]);
  } else {
    switch (currentPath) {
      case '/': Pages.attachHomeListeners(); break;
      case '/dashboard': Pages.attachDashboardListeners(); break;
      case '/play': Pages.attachPlaySelectionListeners(); break;
      case '/game/pong': Pages.attachPongGameListeners(); break;
      case '/login': Pages.attachLoginListeners(); break;
      case '/register': Pages.attachRegisterListeners(); break;
      case '/verify-2fa': Pages.attachVerify2FAListeners(); break;
      case '/2fa-setup': Pages.attach2FASetupListeners(); break;
      case '/forgot-password': Pages.attachForgotPasswordListeners(); break;
      case '/reset-password': Pages.attachResetPasswordListeners(); break;
      case '/change-password': Pages.attachChangePasswordListeners(); break;
      case '/gdpr': 
      case '/view-data': 
      case '/export-data': 
      case '/update-data': 
      case '/anonymize-account': 
      case '/delete-account': Pages.attachGdprListeners(); break;
    }
  }
}
