import { checkAuthStatus } from "../../../services";

export async function renderTournamentBracket(tournament: any): Promise<string> {
  if (!tournament.matches || tournament.matches.length === 0) {
    return '<p>Bracket not generated yet</p>';
  }

  const totalRounds = tournament.total_rounds || Math.ceil(Math.log2(tournament.max_participants));
  const matchesByRound: Record<number, any[]> = {};
  
  for (let i = 1; i <= totalRounds; i++) {
    matchesByRound[i] = [];
  }

  tournament.matches.forEach((match: any) => {
    matchesByRound[match.round_number].push(match);
  });

  for (let round = 1; round <= totalRounds; round++) {
    if (matchesByRound[round].length === 0) {
      if (round === 1) {
        const numFirstRoundMatches = tournament.max_participants / 2;
        for (let i = 0; i < numFirstRoundMatches; i++) {
          matchesByRound[round].push({
            id: `future-${round}-${i}`,
            round_number: round,
            match_number: i + 1,
            player1_name: 'TBD',
            player2_name: 'TBD',
            status: 'pending',
            isPlaceholder: true
          });
        }
      } else {
        const prevRoundMatches = matchesByRound[round - 1] || [];
        const numMatches = Math.ceil(prevRoundMatches.length / 2);
        
        for (let i = 0; i < numMatches; i++) {
          const prevMatch1 = prevRoundMatches[i * 2];
          const prevMatch2 = prevRoundMatches[i * 2 + 1];

          matchesByRound[round].push({
            id: `future-${round}-${i}`,
            round_number: round,
            match_number: i + 1,
            player1_name: prevMatch1.winner_name || 'TBD',
            player2_name: prevMatch2.winner_name || 'TBD',
            status: 'pending',
            score1: null,
            score2: null,
            winner_id: null,
            isPlaceholder: true
          });
        }
      }
    }
  }

  return `
    <div class="bracket-container" id="bracket-container">
      ${Array.from({ length: totalRounds }, (_, i) => `
        <div class="round-header">${getRoundTitle(i + 1, totalRounds)}</div>
      `).join('')}

      ${await Promise.all(
        Array.from({ length: totalRounds }, async (_, roundIndex) => {
          const roundNumber = roundIndex + 1;
          const roundMatches = matchesByRound[roundNumber];
          const connectorClass = roundNumber === 2 ? 'qf' : roundNumber === 3 ? 'sf' : '';

          return `
            <div class="round">
              ${await Promise.all(
                roundMatches.map(async (match, index) => `
                  <div class="match-group">
                    <div class="match ${match.status} ${match.isPlaceholder ? 'placeholder' : ''}">
                      <div class="players">
                        <div class="player ${match.winner_name === match.player1_name ? 'winner' : ''} ${!match.player1_name || match.player1_name === 'TBD' ? 'tbd' : ''}">
                          ${match.player1_name || 'TBD'} <span class="score">${match.score1 ?? '-'}</span>
                        </div>
                        <div class="player ${match.winner_name === match.player2_name ? 'winner' : ''} ${!match.player2_name || match.player2_name === 'TBD' ? 'tbd' : ''}">
                          ${match.player2_name || 'TBD'} <span class="score">${match.score2 ?? '-'}</span>
                        </div>
                      </div>
                      ${(await shouldShowStartButton(match, tournament))
                        ? `<button class="start-match-btn" data-match-id="${match.id}">Start Match</button>`
                        : match.status === 'in_progress'
                          ? `<button class="match-status in-progress">In Progress</button>`
                          : match.status === 'completed'
                            ? `<button class="match-status completed">Completed</button>`
                            : tournament.tournament_settings.gameMode === 'online' 
                              ? `<button class="match-status not-your-match">Not Your Match</button>`
                              : `<button class="match-status waiting">Waiting</button>`
                      }
                    </div>
                    ${roundNumber < totalRounds && index % 2 === 0 ? `<div class="connector ${connectorClass}"></div>` : ''}
                    ${roundNumber < totalRounds && index % 2 === 1 ? `<div class="connector reverse ${connectorClass}"></div>` : ''}
                  </div>
                `)
              ).then((results) => results.join(''))}
            </div>
          `;
        })
      ).then((results) => results.join(''))}
    </div>

    <style>
      .bracket-container {
        display: grid;
        grid-template-columns: repeat(${totalRounds}, 250px);
        align-items: center;
      }
    </style>
  `;
}

async function shouldShowStartButton(match: any, tournament: any): Promise<boolean> {
  if (match.isPlaceholder) return false;
  if (match.status !== 'pending') return false;
  if (!match.player1_id || !match.player2_id) return false;
  if (tournament.status !== 'in_progress') return false;
  
  const currentUser = await checkAuthStatus();
  if (tournament.tournament_settings.gameMode === 'online') {
    return !!(currentUser?.id && (match.player1_id === currentUser.id || match.player2_id === currentUser.id));
  }
  return true;
}

function getRoundTitle(roundNumber: number, totalRounds: number): string {
  if (roundNumber === totalRounds) return 'Final';
  if (roundNumber === totalRounds - 1) return 'Semi-Finals';
  if (roundNumber === totalRounds - 2) return 'Quarter-Finals';
  return `Round ${roundNumber}`;
}
