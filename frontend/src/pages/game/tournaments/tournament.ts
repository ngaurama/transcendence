import { startTournament, startTournamentMatch, deleteTournament } from '../../../services/PongService';
import { checkAuthStatus } from '../../../services'
import { renderTournamentBracket } from './tournamentBracket';

export async function tournamentPage(): Promise<string> {
  const user = await checkAuthStatus();
  if (!user) {
    (window as any).navigate('/');
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

    const isCompleted = tournament.status === 'completed';
    const hasWinner = tournament.winner_id && tournament.winner_name;

    return `
      <div class="max-w-6xl mx-auto bg-gray-800 p-6 rounded-lg">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl">${tournament.name}</h2>
          ${tournament.creator_id === user.id
        ? `<button id="delete-tournament" class="bg-red-600 p-2 rounded text-sm">Delete Tournament</button>`
        : ''
      }
        </div>
        
        ${isCompleted && hasWinner
        ? `<div class="bg-green-900 border border-green-700 rounded-lg p-4 mb-6 text-center">
              <h3 class="text-xl font-bold text-green-300 mb-2">🏆 Tournament Completed! 🏆</h3>
              <p class="text-lg text-green-200">Winner: <span class="font-bold">${tournament.winner_name}</span></p>
              <p class="text-sm text-green-400 mt-2">Congratulations to the champion!</p>
              <button id="leave-tournament" class="mt-4 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors">
                Leave Tournament
              </button>
            </div>`
        : ''
      }
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 class="text-lg mb-3">Tournament Info</h3>
            <p>Status: ${tournament.status}</p>
            <p>Players: ${participants.length}/${tournament.max_participants}</p><br>
            <h4>Details: </h4>
            <p>Type: ${tournament.tournament_settings.gameMode === 'local' ? 'Local' : 'Online'}</p>
            <p>Powerups: ${tournament.tournament_settings.powerups_enabled ? 'Enabled' : 'Disabled'}</p>
            <p>Points to Win: ${tournament.tournament_settings.points_to_win}</p>
            <p>Board Variant: ${tournament.tournament_settings.board_variant || 'Classic'}</p>
            ${hasWinner ? `<p>Winner: ${tournament.winner_name}</p>` : ''}
          </div>

          
          <div id="tournament-participants">
            ${participants.length > 0
              ? `<ul class="space-y-1">
                  ${participants.map((p: any) => `
                    <li class="text-sm ${p.user_id === tournament.winner_id ? 'text-green-400 font-bold' : ''}">
                      ${p.display_name}${p.is_guest ? ' (Guest)' : ''}
                      ${p.user_id === tournament.winner_id ? ' 🏆' : ''}
                    </li>
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
                ${await renderTournamentBracket(tournament)}
              </div>
            </div>`
        : ''
      }

        ${!isCompleted
        ? `<div class="mt-6">
              <button id="leave-tournament" class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors">
                Leave Tournament
              </button>
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


  (window as any).refreshTournamentParticipants = function(participants: any[]) {
    const participantsContainer = document.querySelector('#tournament-participants');
    if (participantsContainer) {
      participantsContainer.innerHTML = participants.length > 0
        ? `<ul class="space-y-1">
            ${participants.map((p: any) => `
              <li class="text-sm">
                ${p.display_name}${p.is_guest ? ' (Guest)' : ''}
              </li>
            `).join('')}
          </ul>`
        : '<p class="text-gray-400">No participants yet</p>';
    }
  };

const deleteTournamentBtn = document.getElementById('delete-tournament');
if (deleteTournamentBtn) {
  deleteTournamentBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete this tournament? All participants will be removed.')) {
      try {
        await deleteTournament(tournamentId);
        (window as any).navigate('/play');
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to delete tournament');
      }
    }
  });
}

  const leaveTournamentBtn = document.getElementById('leave-tournament');
  if (leaveTournamentBtn) {
    leaveTournamentBtn.addEventListener('click', () => {
      (window as any).navigate('/');
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
