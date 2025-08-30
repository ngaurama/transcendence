// pages/tournamentSelection.ts
import { getOpenTournaments, joinTournament } from '../../../services/PongService';
import { checkAuthStatus } from '../../../services';

export async function tournamentSelectionPage(): Promise<string> {
  const user = await checkAuthStatus();
  if (!user) {
    (window as any).navigate('/login');
    return '';
  }

  const tournaments = await getOpenTournaments();

  return `
    <div class="max-w-2xl mx-auto bg-gray-800 p-6 rounded-lg">
      <h2 class="text-2xl mb-6 text-center">Tournaments</h2>
      <button id="create-tournament" class="w-full bg-purple-500 p-2 rounded mb-4">Create New Tournament</button>
      <h3 class="text-xl mb-4">Open Tournaments</h3>
      ${tournaments.length > 0
        ? `<ul class="space-y-2">
            ${tournaments.map(t => `
              <li class="bg-gray-700 p-3 rounded flex justify-between items-center">
                <span>${t.name} (${t.current_participants}/${t.max_participants})</span>
                <button class="join-tournament-btn bg-blue-500 p-2 rounded" data-id="${t.id}">Join</button>
              </li>
            `).join('')}
          </ul>`
        : '<p>No open tournaments available.</p>'
      }
    </div>
  `;
}

export function attachTournamentSelectionListeners() {
  const createTournamentBtn = document.getElementById('create-tournament');
  if (createTournamentBtn) {
    createTournamentBtn.addEventListener('click', () => {
      (window as any).navigate('/play');
    });
  }

  document.querySelectorAll('.join-tournament-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tournamentId = btn.getAttribute('data-id');
      if (tournamentId) {
        try {
          await joinTournament(tournamentId);
          (window as any).navigate(`/tournament/${tournamentId}`);
        } catch (error) {
          alert(error instanceof Error ? error.message : 'Failed to join tournament');
        }
      }
    });
  });
}
