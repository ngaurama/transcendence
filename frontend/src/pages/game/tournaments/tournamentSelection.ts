// pages/tournamentSelection.ts
import { getOpenTournaments, joinTournament } from '../../../services/PongService';
import { checkAuthStatus } from '../../../services';

export async function tournamentSelectionPage(): Promise<string> {
  const user = await checkAuthStatus();
  if (!user) {
    (window as any).navigate('/');
    return '';
  }

  const tournaments = await getOpenTournaments();

  return `
    <div class="max-w-2xl mx-auto bg-gray-800 p-6 rounded-lg">
      <h2 class="text-2xl mb-6 text-center">Tournaments</h2>
      <button id="create-tournament" class="w-full bg-purple-500 p-2 rounded mb-4">Create New Tournament</button>
      <h3 class="text-xl mb-4">Open Tournaments</h3>
      <div id="tournaments-list">
        ${tournaments.length > 0
          ? `<ul class="space-y-2" id="tournaments-ul">
              ${tournaments.map(t => renderTournamentListItem(t)).join('')}
            </ul>`
          : '<p id="no-tournaments">No open tournaments available.</p>'
        }
      </div>
    </div>
  `;
}

function renderTournamentListItem(tournament: any): string {
  return `
    <li class="bg-gray-700 p-3 rounded flex justify-between items-center tournament-item" 
        data-id="${tournament.id}" 
        data-name="${tournament.name}" 
        data-max-participants="${tournament.max_participants}" 
        data-settings='${JSON.stringify(tournament.tournament_settings || {})}'>
      <div>
        <span class="font-semibold">${tournament.name}</span>
        <p class="text-sm text-gray-300">
          ${tournament.current_participants}/${tournament.max_participants} players • 
          ${tournament.tournament_settings?.powerups_enabled ? 'Powerups' : 'No Powerups'} • 
          ${tournament.tournament_settings?.points_to_win} points to win
        </p>
      </div>
      <button class="join-tournament-btn bg-blue-500 p-2 rounded" data-id="${tournament.id}">Join</button>
    </li>
  `;
}

(window as any).addTournamentToList = function(tournament: any) {
  const tournamentsList = document.getElementById('tournaments-ul');
  const noTournaments = document.getElementById('no-tournaments');
  const container = document.getElementById('tournaments-list');

  if (document.querySelector(`.tournament-item[data-id="${tournament.id}"]`)) {
    console.warn(`Tournament ${tournament.id} already exists in the list`);
    return;
  }

  if (noTournaments) {
    noTournaments.remove();
  }

  if (!tournamentsList && container) {
    container.innerHTML = `<ul class="space-y-2" id="tournaments-ul">${renderTournamentListItem(tournament)}</ul>`;
  } else if (tournamentsList) {
    tournamentsList.insertAdjacentHTML('afterbegin', renderTournamentListItem(tournament));
  }
  attachTournamentSelectionListeners();
};

(window as any).updateTournamentParticipants = function(tournamentId: string, participants: any[]) {
  const tournamentItem = document.querySelector(`.tournament-item[data-id="${tournamentId}"]`) as HTMLElement | null;
  if (tournamentItem) {
    const infoDiv = tournamentItem.querySelector('div');
    if (infoDiv) {
      const settings = JSON.parse(tournamentItem.dataset.settings || '{}');
      infoDiv.innerHTML = `
        <span class="font-semibold">${tournamentItem.dataset.name}</span>
        <p class="text-sm text-gray-300">
          ${participants.length}/${tournamentItem.dataset.maxParticipants} players • 
          ${settings.powerups_enabled ? 'Powerups' : 'No Powerups'} • 
          ${settings.points_to_win} points to win
        </p>
      `;
    }
  }
};

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
