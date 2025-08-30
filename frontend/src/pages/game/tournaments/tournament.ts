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

export function renderTournamentBracket(tournament: any): string {
  if (!tournament.matches || tournament.matches.length === 0) {
    return '<p>Bracket not generated yet</p>';
  }

  const totalRounds = tournament.total_rounds || Math.ceil(Math.log2(tournament.max_participants));
  const matchesByRound: Record<number, any[]> = {};
  
  // Initialize matches by round
  for (let i = 1; i <= totalRounds; i++) {
    matchesByRound[i] = [];
  }

  // Fill known matches
  tournament.matches.forEach((match: any) => {
    matchesByRound[match.round_number].push(match);
  });

  // Generate future round matches
  for (let round = 2; round <= totalRounds; round++) {
    const prevRoundMatches = matchesByRound[round - 1];
    const numMatches = Math.floor(prevRoundMatches.length / 2) || 1;
    
    for (let i = 0; i < numMatches; i++) {
      const prevMatch1 = prevRoundMatches[i * 2];
      const prevMatch2 = prevRoundMatches[i * 2 + 1];
      
      matchesByRound[round].push({
        id: `future-${round}-${i}`,
        round_number: round,
        match_number: i + 1,
        player1_name: prevMatch1?.winner_id ? 
          (prevMatch1.player1_id === prevMatch1.winner_id ? prevMatch1.player1_name : prevMatch1.player2_name) : 'TBD',
        player2_name: prevMatch2?.winner_id ? 
          (prevMatch2.player1_id === prevMatch2.winner_id ? prevMatch2.player1_name : prevMatch2.player2_name) : 'TBD',
        status: 'pending',
        score1: null,
        score2: null,
        winner_id: null
      });
    }
  }

  return `
    <div class="tournament-bracket-tree">
      ${Array.from({ length: totalRounds }, (_, roundIndex) => {
        const roundNumber = roundIndex + 1;
        const roundMatches = matchesByRound[roundNumber];

        return `
          <div class="round round-${roundNumber}">
            <h4 class="round-title">${roundNumber === totalRounds ? 'Final' : `Round ${roundNumber}`}</h4>
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
                ${match.status === 'pending' && match.id
                  ? `<button class="start-match-btn" data-match-id="${match.id}">Start Match</button>` 
                  : ''}
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
        min-width: 200px;
      }

      .round-title {
        text-align: center;
        margin-bottom: 10px;
        font-weight: bold;
        color: #ffffff;
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
        flex-direction: column;
        gap: 8px;
        align-items: center;
      }

      .player {
        padding: 5px;
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .player.winner {
        font-weight: bold;
        color: #4ade80;
      }

      .score {
        font-size: 0.85rem;
        color: #f9fafb;
      }

      .vs {
        font-size: 0.75rem;
        color: #9ca3af;
        padding: 2px;
      }

      .start-match-btn {
        margin-top: 8px;
        background: #3b82f6;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
      }

      /* Connecting lines */
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

      /* Vertical connecting lines for matches */
      .round:not(:last-child) .match:nth-child(odd)::after {
        content: '';
        position: absolute;
        right: -20px;
        top: 0;
        height: calc(50% + 20px);
        width: 2px;
        background: #9ca3af;
      }

      .round:not(:last-child) .match:nth-child(even)::after {
        content: '';
        position: absolute;
        right: -20px;
        bottom: 0;
        height: calc(50% + 20px);
        width: 2px;
        background: #9ca3af;
      }
    </style>
  `;
}


// import { startTournament, startTournamentMatch, deleteTournament } from '../../../services/PongService';
// import { checkAuthStatus } from '../../../services'

// export async function tournamentPage(): Promise<string> {
//   const user = await checkAuthStatus();
//   if (!user) {
//     (window as any).navigate('/login');
//     return '';
//   }

//   const tournamentId = (window as any).tournamentId;
//   if (!tournamentId) return '<h2>Error: No tournament ID</h2>';

//   try {
//     const response = await fetch(`/api/pong/tournament/${tournamentId}`, {
//       headers: {
//         'Authorization': `Bearer ${localStorage.getItem('access_token')}`
//       }
//     });

//     if (!response.ok) {
//       return `<h2>Error loading tournament</h2>`;
//     }

//     const tournament = await response.json();
//     console.log(tournament);

//     const participantsResponse = await fetch(`/api/pong/tournament/${tournamentId}/participants`, {
//       headers: {
//         'Authorization': `Bearer ${localStorage.getItem('access_token')}`
//       }
//     });

//     const participants = participantsResponse.ok ? await participantsResponse.json() : [];

//     return `
//       <div class="max-w-6xl mx-auto bg-gray-800 p-6 rounded-lg">
//         <div class="flex justify-between items-center mb-6">
//           <h2 class="text-2xl">${tournament.name}</h2>
//           ${tournament.creator_id === user.id
//         ? `<button id="delete-tournament" class="bg-red-600 p-2 rounded text-sm">Delete Tournament</button>`
//         : ''
//       }
//         </div>
        
//         <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
//           <div>
//             <h3 class="text-lg mb-3">Tournament Info</h3>
//             <p>Status: ${tournament.status}</p>
//             <p>Players: ${participants.length}/${tournament.max_participants}</p>
//             <p>Type: ${tournament.tournament_settings.gameMode === 'local' ? 'Local' : 'Online'}</p>
//           </div>
          
//           <div>
//             <h3 class="text-lg mb-3">Participants</h3>
//             ${participants.length > 0
//         ? `<ul class="space-y-1">
//                   ${participants.map((p: any) => `
//                     <li class="text-sm">${p.display_name}${p.is_guest ? ' (Guest)' : ''}</li>
//                   `).join('')}
//                 </ul>`
//         : '<p class="text-gray-400">No participants yet</p>'
//       }
//           </div>
//         </div>

//         ${tournament.status === 'registration' && tournament.creator_id === user.id
//         ? `<button id="start-tournament" class="w-full bg-green-500 p-2 rounded mb-4">Start Tournament</button>`
//         : ''
//       }

//         ${tournament.status !== 'registration'
//         ? `<div>
//               <h3 class="text-lg mb-3">Tournament Bracket</h3>
//               <div id="tournament-bracket" class="bg-gray-700 p-4 rounded overflow-x-auto">
//                 ${renderTournamentBracket(tournament)}
//               </div>
//             </div>`
//         : ''
//       }
//       </div>
//     `;
//   } catch (error) {
//     return `<h2>Error loading tournament</h2>`;
//   }
// }

// export function attachTournamentListeners(tournamentId: string) {
//   const startTournamentBtn = document.getElementById('start-tournament');
//   if (startTournamentBtn) {
//     startTournamentBtn.addEventListener('click', async () => {
//       try {
//         await startTournament(tournamentId);
//         (window as any).navigate(`/tournament/${tournamentId}`);
//       } catch (error) {
//         alert(error instanceof Error ? error.message : 'Failed to start tournament');
//       }
//     });
//   }

//   const deleteTournamentBtn = document.getElementById('delete-tournament');
//   if (deleteTournamentBtn) {
//     deleteTournamentBtn.addEventListener('click', async () => {
//       if (confirm('Are you sure you want to delete this tournament?')) {
//         try {
//           await deleteTournament(tournamentId);
//           (window as any).navigate('/play');
//         } catch (error) {
//           alert(error instanceof Error ? error.message : 'Failed to delete tournament');
//         }
//       }
//     });
//   }

//   document.querySelectorAll('.start-match-btn').forEach(btn => {
//     btn.addEventListener('click', async () => {
//       const matchId = btn.getAttribute('data-match-id');
//       if (matchId) {
//         try {
//           const gameId = await startTournamentMatch(tournamentId, matchId);
//           (window as any).navigate(`/game/pong?game_id=${gameId}&tournament_id=${tournamentId}`);
//         } catch (error) {
//           alert(error instanceof Error ? error.message : 'Failed to start match');
//         }
//       }
//     });
//   });
// }


// export function renderTournamentBracket(tournament: any): string {
//   if (!tournament.matches || tournament.matches.length === 0) {
//     return '<p>Bracket not generated yet</p>';
//   }
//   const matchesByRound: Record<number, any[]> = {};
//   tournament.matches.forEach((match: any) => {
//     if (!matchesByRound[match.round_number]) matchesByRound[match.round_number] = [];
//     matchesByRound[match.round_number].push(match);
//   });

//   const totalRounds = Math.max(...Object.keys(matchesByRound).map(Number));
//   console.log("total round", totalRounds);

//   return `
//     <div class="tournament-bracket-tree">
//       ${Array.from({ length: totalRounds }, (_, roundIndex) => {
//     const roundNumber = roundIndex + 1;
//     const roundMatches = matchesByRound[roundNumber] || [];

//     return `
//           <div class="round round-${roundNumber}">
//             <h4 class="round-title">Round ${roundNumber}</h4>
//             ${roundMatches.map((match: any) => `
//               ${roundMatches.map((match: any) => `
//                 <div class="match ${match.status}">
//                   <div class="players">
//                     <div class="player ${match.winner_id === match.player1_id ? 'winner' : ''}">
//                       ${match.player1_name || 'TBD'} 
//                       <span class="score">${match.score1 ?? '-'}</span>
//                     </div>
//                     <div class="vs">vs</div>
//                     <div class="player ${match.winner_id === match.player2_id ? 'winner' : ''}">
//                       ${match.player2_name || 'TBD'} 
//                       <span class="score">${match.score2 ?? '-'}</span>
//                     </div>
//                   </div>
//                   ${match.status === 'pending' 
//                     ? `<button class="start-match-btn" data-match-id="${match.id}">Start Match</button>` 
//                     : ''}
//                 </div>
//               `).join('')}
//             `).join('')}
//           </div>
//         `;
//   }).join('')}
//     </div>

//     <style>
//       .tournament-bracket-tree {
//         display: flex;
//         gap: 40px;
//         overflow-x: auto;
//         padding: 20px;
//       }

//       .round {
//         display: flex;
//         flex-direction: column;
//         gap: 40px;
//         position: relative;
//       }

//       .round-title {
//         text-align: center;
//         margin-bottom: 10px;
//         font-weight: bold;
//       }

//       .match {
//         position: relative;
//         background: #374151;
//         padding: 10px;
//         border-radius: 6px;
//         min-width: 180px;
//         text-align: center;
//       }

//       .match.completed { border: 2px solid #4ade80; }
//       .match.in_progress { border: 2px solid #facc15; }
//       .match.pending { border: 1px solid #9ca3af; }

//       .players {
//         display: flex;
//         justify-content: space-between;
//         align-items: center;
//       }

//       .player {
//         padding: 5px;
//       }

//       .player.winner {
//         font-weight: bold;
//         color: #4ade80;
//       }

//       .score {
//         margin-left: 5px;
//         font-size: 0.85rem;
//         color: #f9fafb;
//       }

//       .vs {
//         font-size: 0.75rem;
//         color: #9ca3af;
//         padding: 0 5px;
//       }

//       /* Optional: connect lines */
//       .round:not(:last-child) .match::after {
//         content: '';
//         position: absolute;
//         right: -20px;
//         top: 50%;
//         width: 20px;
//         height: 2px;
//         background: #9ca3af;
//       }

//       .round:not(:first-child) .match::before {
//         content: '';
//         position: absolute;
//         left: -20px;
//         top: 50%;
//         width: 20px;
//         height: 2px;
//         background: #9ca3af;
//       }
//     </style>
//   `;
// }
