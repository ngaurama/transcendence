import { startTournament, startTournamentMatch, deleteTournament } from '../../../services/PongService';
import { checkAuthStatus } from '../../../services'

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

    // Get participants
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
            <p>Type: ${tournament.tournament_settings.mode === 'local' ? 'Local' : 'Online'}</p>
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


export function renderTournamentBracket(tournament: any): string {
  if (!tournament.matches || tournament.matches.length === 0) {
    return '<p>Bracket not generated yet</p>';
  }

  // Group matches by round
  const matchesByRound: Record<number, any[]> = {};
  tournament.matches.forEach((match: any) => {
    if (!matchesByRound[match.round_number]) matchesByRound[match.round_number] = [];
    matchesByRound[match.round_number].push(match);
  });

  const totalRounds = Math.max(...Object.keys(matchesByRound).map(Number));

  return `
    <div class="tournament-bracket-tree">
      ${Array.from({ length: totalRounds }, (_, roundIndex) => {
        const roundNumber = roundIndex + 1;
        const roundMatches = matchesByRound[roundNumber] || [];

        return `
          <div class="round round-${roundNumber}">
            <h4 class="round-title">Round ${roundNumber}</h4>
            ${roundMatches.map((match: any) => `
              <div class="match ${match.status}">
                <div class="players">
                  <div class="player ${match.winner_id === match.player1_id ? 'winner' : ''}">
                    ${match.player1_name || 'TBD'} 
                    <span class="score">${match.score1 ?? '-'}</span>
                  </div>
                  <div class="vs">vs</div>
                  <div class="player ${match.winner_id === match.player2_id ? 'winner' : ''}">
                    ${match.player2_name || 'TBD'} 
                    <span class="score">${match.score2 ?? '-'}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }).join('')}
    </div>

    <style>
      .tournament-bracket-tree {
        display: flex;
        gap: 40px;
        overflow-x: auto;
        padding: 20px;
      }

      .round {
        display: flex;
        flex-direction: column;
        gap: 40px;
        position: relative;
      }

      .round-title {
        text-align: center;
        margin-bottom: 10px;
        font-weight: bold;
      }

      .match {
        position: relative;
        background: #374151;
        padding: 10px;
        border-radius: 6px;
        min-width: 180px;
        text-align: center;
      }

      .match.completed { border: 2px solid #4ade80; }
      .match.in_progress { border: 2px solid #facc15; }
      .match.pending { border: 1px solid #9ca3af; }

      .players {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .player {
        padding: 5px;
      }

      .player.winner {
        font-weight: bold;
        color: #4ade80;
      }

      .score {
        margin-left: 5px;
        font-size: 0.85rem;
        color: #f9fafb;
      }

      .vs {
        font-size: 0.75rem;
        color: #9ca3af;
        padding: 0 5px;
      }

      /* Optional: connect lines */
      .round:not(:last-child) .match::after {
        content: '';
        position: absolute;
        right: -20px;
        top: 50%;
        width: 20px;
        height: 2px;
        background: #9ca3af;
      }

      .round:not(:first-child) .match::before {
        content: '';
        position: absolute;
        left: -20px;
        top: 50%;
        width: 20px;
        height: 2px;
        background: #9ca3af;
      }
    </style>
  `;
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

  // Add CSS for the bracke

//   // Add match start listeners
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








// export function renderTournamentBracket(tournament: any): string {
//   if (!tournament.matches || tournament.matches.length === 0) {
//     return '<p>Bracket not generated yet</p>';
//   }

//   // Group matches by round
//   const matchesByRound: Record<number, any[]> = {};
//   tournament.matches.forEach((match: any) => {
//     if (!matchesByRound[match.round_number]) {
//       matchesByRound[match.round_number] = [];
//     }
//     matchesByRound[match.round_number].push(match);
//   });

//   const totalRounds = Math.max(...Object.keys(matchesByRound).map(Number));
  
//   return `
//     <div class="tournament-bracket flex space-x-4 min-w-max">
//       ${Array.from({ length: totalRounds }, (_, roundIndex) => {
//         const roundNumber = roundIndex + 1;
//         const roundMatches = matchesByRound[roundNumber] || [];
        
//         return `
//           <div class="round round-${roundNumber} flex flex-col space-y-4">
//             <h4 class="text-center font-semibold mb-2">Round ${roundNumber}</h4>
//             ${roundMatches.map((match: any) => `
//               <div class="match bg-gray-600 p-3 rounded min-w-[200px] ${
//                 match.status === 'completed' ? 'border-2 border-green-400' : 
//                 match.status === 'in_progress' ? 'border-2 border-yellow-400' : 
//                 'border border-gray-500'
//               }">
//                 <div class="players mb-2">
//                   <div class="player1 ${match.winner_id === match.player1_id ? 'text-green-300 font-bold' : ''}">
//                     ${match.player1_name || 'TBD'}
//                   </div>
//                   <div class="vs text-xs text-gray-400 text-center">vs</div>
//                   <div class="player2 ${match.winner_id === match.player2_id ? 'text-green-300 font-bold' : ''}">
//                     ${match.player2_name || 'TBD'}
//                   </div>
//                 </div>
                
//                 <div class="match-status text-center mb-2">
//                   <span class="text-sm ${
//                     match.status === 'completed' ? 'text-green-400' : 
//                     match.status === 'in_progress' ? 'text-yellow-400' : 
//                     'text-gray-400'
//                   }">
//                     ${match.status}
//                   </span>
//                 </div>
                
//                 ${match.status === 'pending' && tournament.tournament_settings.mode === 'local'
//                   ? `<button class="start-match-btn w-full bg-blue-500 px-2 py-1 rounded text-sm" 
//                        data-match-id="${match.id}">
//                        Start Match
//                      </button>`
//                   : ''
//                 }
                
//                 ${match.status === 'completed' && match.winner_id
//                   ? `<div class="winner text-center text-sm text-green-300">
//                        Winner: ${match.winner_name}
//                      </div>`
//                   : ''
//                 }
//               </div>
//             `).join('')}
//           </div>
//         `;
//       }).join('')}
//     </div>
//   `;
// }




  // const style = document.createElement('style');
  // style.textContent = `
  //   .tournament-bracket {
  //     display: flex;
  //     gap: 20px;
  //     padding: 20px;
  //   }
    
  //   .round {
  //     display: flex;
  //     flex-direction: column;
  //     gap: 15px;
  //   }
    
  //   .match {
  //     min-width: 200px;
  //     padding: 10px;
  //     border-radius: 8px;
  //     background: #374151;
  //     border: 1px solid #4B5563;
  //   }
    
  //   .players {
  //     text-align: center;
  //   }
    
  //   .player1, .player2 {
  //     padding: 5px;
  //   }
    
  //   .vs {
  //     margin: 2px 0;
  //     color: #9CA3AF;
  //   }
    
  //   .start-match-btn {
  //     width: 100%;
  //     padding: 5px;
  //     background: #3B82F6;
  //     color: white;
  //     border: none;
  //     border-radius: 4px;
  //     cursor: pointer;
  //   }
    
  //   .start-match-btn:hover {
  //     background: #2563EB;
  //   }
  // `;
  // document.head.appendChild(style);