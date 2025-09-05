import { checkAuthStatus } from '../services';

export async function homePage(): Promise<string> {
  const user = await checkAuthStatus();
  if (!user) return '<h2>Welcome! Please login or register.</h2>';

  return `
    <div class="text-center py-20">
      <h2 class="text-4xl mb-8">Welcome, ${user.display_name}!</h2>
      <button id="play-now-btn" class="bg-blue-600 text-white px-8 py-4 rounded-lg text-xl hover:bg-blue-700">
        Play Now
      </button>
    </div>
  `;
}

export function attachHomeListeners() {
  const playBtn = document.getElementById('play-now-btn');
  if (playBtn) playBtn.addEventListener('click', () => {
    (window as any).navigate('/play');
  });
}
