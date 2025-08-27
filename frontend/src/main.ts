import { initRouter } from './router';
import { checkAuthStatus } from './services';

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  
  if (urlParams.has('access_token')) {
    localStorage.setItem('access_token', urlParams.get('access_token') || '');
    localStorage.setItem('refresh_token', urlParams.get('refresh_token') || '');
    window.history.replaceState({}, '', '/');
  } else if (urlParams.has('error')) {
    window.history.replaceState({}, '', window.location.pathname + window.location.search);
  }

  const user = await checkAuthStatus();
  const allowedUnauthenticatedRoutes = [
    '/login',
    '/register', 
    '/verify-email',
    '/forgot-password',
    '/reset-password',
    '/auth/callback'
  ];
  if (!user && !allowedUnauthenticatedRoutes.includes(window.location.pathname) && !urlParams.has('error')) {
    window.history.replaceState({}, '', '/login');
  }

  initRouter();
});

(window as any).navigate = (path: string) => {
  history.pushState({}, '', path);
  initRouter();
};
