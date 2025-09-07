// main.ts
import { initRouter, render } from './router';
import { checkAuthStatus } from './services';
import { initUserWebSocket } from './services/UserWebSocket';
import { ParticleSystem } from './utils/particles';

let particleSystem: ParticleSystem | null = null;

(window as any).dashboardHistory = {
  history: [] as string[],
  
  push: function(path: string) {
    this.history.push(path);
    if (this.history.length > 10) {
      this.history = this.history.slice(-10);
    }
  },
  
  pop: function(): string | null {
    return this.history.pop() || null;
  },
  
  getPrevious: function(): string | null {
    if (this.history.length < 2) return null;
    return this.history[this.history.length - 2];
  },
  
  clear: function() {
    this.history = [];
  }
};

async function main() {
  const homeBtnContainer = document.getElementById('home-btn-container');
  const lottieContainer = document.getElementById('home-lottie');
  const homeText = homeBtnContainer?.querySelector('.home-text') as HTMLElement | null;
  if (homeBtnContainer && lottieContainer && homeText) {
    let lottieAnim: any = null;
    homeBtnContainer.addEventListener('mouseenter', () => {
      homeText.style.opacity = '0';
      lottieContainer.style.display = 'flex';
      if (lottieAnim) {
        lottieAnim.destroy();
        lottieAnim = null;
      }
      lottieAnim = (window as any).lottie.loadAnimation({
        container: lottieContainer,
        renderer: 'svg',
        loop: false,
        autoplay: true,
        path: '/home_icon.json'
      });
    });
    homeBtnContainer.addEventListener('mouseleave', () => {
      homeText.style.opacity = '1';
      lottieContainer.style.display = 'none';
      if (lottieAnim) {
        lottieAnim.destroy();
        lottieAnim = null;
      }
    });
  }

  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.has('access_token')) {
    localStorage.setItem('access_token', urlParams.get('access_token') || '');
    localStorage.setItem('refresh_token', urlParams.get('refresh_token') || '');
    window.history.replaceState({}, '', '/');
  } else if (urlParams.has('error')) {
    window.history.replaceState({}, '', window.location.pathname + window.location.search);
  }

  if (urlParams.has('tournament_id')) {
    const tournamentId = urlParams.get('tournament_id');
    window.history.replaceState({}, '', `/tournament/${tournamentId}`);
  }

  const user = await checkAuthStatus();
  const allowedUnauthenticatedRoutes = [
    '/login',
    '/register',
    '/verify-email',
    '/forgot-password',
    '/reset-password',
    '/auth/callback',
  ];
  if (!user && !allowedUnauthenticatedRoutes.includes(window.location.pathname) && !urlParams.has('error')) {
    window.history.replaceState({}, '', '/login');
  }

  const currentPath = window.location.pathname;
  if (currentPath.startsWith('/dashboard') || currentPath.startsWith('/profile/')) {
    (window as any).dashboardHistory.push(currentPath);
  }

  const homeLink = document.querySelector('a[href="/"]');
  if (homeLink) {
    homeLink.addEventListener('click', (e) => {
      e.preventDefault();
      (window as any).navigate('/');
    });
  }

  particleSystem = new ParticleSystem();
  if (user) {
    initUserWebSocket();
  }
  initRouter();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

(window as any).navigate = (path: string) => {
  if (path.startsWith('/dashboard') || path.startsWith('/profile/')) {
    (window as any).dashboardHistory.push(path);
  }
  
  history.pushState({}, '', path);
  render();
};

(window as any).navigateBack = () => {
  const currentPath = window.location.pathname;
  const previousPath = (window as any).dashboardHistory.getPrevious();
  
  if (currentPath === '/dashboard' && (!previousPath || previousPath === '/dashboard')) {
    (window as any).navigate('/play');
    return;
  }
  
  if (previousPath) {
    (window as any).dashboardHistory.pop();
    (window as any).navigate(previousPath);
    return;
  }
  
  (window as any).navigate('/play');
};

// (window as any).navigate = (path: string) => {
//   history.pushState({}, '', path);
//   render();
// };
