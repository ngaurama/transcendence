import { startTournament, startTournamentMatch, deleteTournament } from '../../../services/PongService';
import { checkAuthStatus } from '../../../services'
import { renderTournamentBracket } from './tournamentBracket';

export async function tournamentPage(): Promise<string> {
  const user = await checkAuthStatus();
  if (!user) {
    (window as any).navigate('/login');
    return '';
  }

  const tournamentId = (window as any).tournamentId;
  if (!tournamentId) return '<h2>Error: No tournament ID</h2>';

  try {
    const response = await fetch(`/api/pong/tournament/${tournamentId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      }
    });

    if (!response.ok) {
      return `<h2>Error loading tournament</h2>`;
    }

    const tournament = await response.json();

    const participantsResponse = await fetch(`/api/pong/tournament/${tournamentId}/participants`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      }
    });

    const participants = participantsResponse.ok ? await participantsResponse.json() : [];

    return `
      <div class="max-w-6xl mx-auto bg-gray-800 p-6 rounded-lg">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl">${tournament.name}</h2>
          ${tournament.creator_id === user.id
        ? `<button id="delete-tournament" class="bg-red-600 p-2 rounded text-sm">Delete Tournament</button>`
        : ''
      }
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 class="text-lg mb-3">Tournament Info</h3>
            <p>Status: ${tournament.status}</p>
            <p>Players: ${participants.length}/${tournament.max_participants}</p>
            <p>Type: ${tournament.tournament_settings.gameMode === 'local' ? 'Local' : 'Online'}</p>
          </div>
          
          <div>
            <h3 class="text-lg mb-3">Participants</h3>
            ${participants.length > 0
        ? `<ul class="space-y-1">
                  ${participants.map((p: any) => `
                    <li class="text-sm">${p.display_name}${p.is_guest ? ' (Guest)' : ''}</li>
                  `).join('')}
                </ul>`
        : '<p class="text-gray-400">No participants yet</p>'
      }
          </div>
        </div>

        ${tournament.status === 'registration' && tournament.creator_id === user.id
        ? `<button id="start-tournament" class="w-full bg-green-500 p-2 rounded mb-4">Start Tournament</button>`
        : ''
      }

        ${tournament.status !== 'registration'
        ? `<div>
              <h3 class="text-lg mb-3">Tournament Bracket</h3>
              <div id="tournament-bracket" class="bg-gray-700 p-4 rounded overflow-x-auto">
                ${renderTournamentBracket(tournament)}
              </div>
            </div>`
        : ''
      }
      </div>
    `;
  } catch (error) {
    return `<h2>Error loading tournament</h2>`;
  }
}

export function attachTournamentListeners(tournamentId: string) {
  const startTournamentBtn = document.getElementById('start-tournament');
  if (startTournamentBtn) {
    startTournamentBtn.addEventListener('click', async () => {
      try {
        await startTournament(tournamentId);
        (window as any).navigate(`/tournament/${tournamentId}`);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to start tournament');
      }
    });
  }

  const deleteTournamentBtn = document.getElementById('delete-tournament');
  if (deleteTournamentBtn) {
    deleteTournamentBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete this tournament?')) {
        try {
          await deleteTournament(tournamentId);
          (window as any).navigate('/play');
        } catch (error) {
          alert(error instanceof Error ? error.message : 'Failed to delete tournament');
        }
      }
    });
  }

  document.querySelectorAll('.start-match-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const matchId = btn.getAttribute('data-match-id');
      if (matchId) {
        try {
          const gameId = await startTournamentMatch(tournamentId, matchId);
          (window as any).navigate(`/game/pong?game_id=${gameId}&tournament_id=${tournamentId}`);
        } catch (error) {
          alert(error instanceof Error ? error.message : 'Failed to start match');
        }
      }
    });
  });
}
