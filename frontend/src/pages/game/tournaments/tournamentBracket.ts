export function renderTournamentBracket(tournament: any): string {
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

      ${Array.from({ length: totalRounds }, (_, roundIndex) => {
        const roundNumber = roundIndex + 1;
        const roundMatches = matchesByRound[roundNumber];
        const connectorClass = roundNumber === 2 ? 'qf' : roundNumber === 3 ? 'sf' : '';

        return `
          <div class="round">
            ${roundMatches.map((match, index) => `
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
                  ${shouldShowStartButton(match, tournament)
                    ? `<button class="start-match-btn" data-match-id="${match.id}">Start Match</button>`
                    : match.isPlaceholder 
                      ? `<button class="disabled-btn" data-match-id="${match.id} disabled"><i>Waiting</i></button>` 
                      : `<button class="disabled-btn" data-match-id="${match.id} disabled">Game Finished</button>`
                  }
                </div>
                  ${roundNumber < totalRounds && index % 2 === 0 ? `<div class="connector ${connectorClass}"></div>` : ''}
                  ${roundNumber < totalRounds && index % 2 === 1 ? `<div class="connector reverse ${connectorClass}"></div>` : ''}
              </div>
            `).join('')}
          </div>
        `;
      }).join('')}
    </div>

    <style>
      .bracket-container {
        display: grid;
        grid-template-columns: repeat(${totalRounds}, 250px);
        align-items: center;
      }

      .round {
        display: flex;
        flex-direction: column;
        justify-content: space-around;
        min-height: 100%;
        position: relative;
        max-width: 220px;
      }

      .round-header {
        text-align: center;
        font-weight: bold;
        padding: 8px;
        color: #e5e7eb;
        background: #4B5563;
        border-radius: 6px;
        width: 180px;
        margin-left: 18px;
      }

      .match {
        background: #374151;
        padding: 15px;
        border-radius: 6px;
        min-width: 180px;
        margin: 15px auto;
        text-align: center;
        border: 1px solid #4B5563;
        position: relative;
      }

      .match.completed { border: 2px solid #4ade80; }
      .match.in_progress { border: 2px solid #facc15; }
      .match.pending { border: 1px solid #9ca3af; }
      .match.placeholder { opacity: 0.6; border: 1px dashed #6b7280; }

      .connector {
        position: absolute;
        top: 50%;
        bottom: 0%;
        left: 100%;
        right: -20px;
        width: 20px;
        border-top: 2px solid #9ca3af;
        border-right: 2px solid #9ca3af;
        height: 100%;
      }

      .connector::after {
        content: "";
        position: absolute;
        top: calc(50% + 5px);
        left: 20px;
        right: 0;
        width: 0;
        height: 0;
        border-top: 10px solid transparent;
        border-bottom: 10px solid transparent;
        border-left: 10px solid #9ca3af;
      }

      .connector.reverse {
        top: -50%;
        bottom: 0%;
        border-top: none;
        border-bottom: 2px solid #9ca3af;
      }

      .connector.reverse::after {
        display: none;
      }

      .connector.qf {
        height: 210px;
      }

      .connector.qf::after {
        top: calc(100% - 10px);
      }

      .connector.reverse.qf {
        top: -62%;
        bottom: 0%;
        border-top: none;
        border-bottom: 2px solid #9ca3af;
      }

      .connector.sf {
        height: 430px;
      }

      .connector.sf::after {
        top: calc(100% - 25px);
      }

      .connector.reverse.sf {
        top: -182%;
        bottom: 0%;
        border-top: none;
        border-bottom: 2px solid #9ca3af;
      }

      .match-group {
        position: relative;
        margin: 10px 0;
      }

      .players {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .player {
        display: flex;
        justify-content: space-between;
        padding: 6px;
        background: #1f2937;
        border-radius: 4px;
      }

      .player.winner {
        font-weight: bold;
        color: #4ade80;
        background: rgba(74, 222, 128, 0.1);
      }

      .player.tbd {
        color: #9ca3af;
        font-style: italic;
      }

      .score {
        font-weight: bold;
      }

      .start-match-btn {
        margin-top: 8px;
        background: #3b82f6;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        border: none;
      }

      .disabled-btn {
        margin-top: 10px;
        background: #982c2c;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: default;
        border: none;
      }

      .start-match-btn:disabled {
        background: #6b7280;
        cursor: not-allowed;
      }
    </style>
  `;
}

function shouldShowStartButton(match: any, tournament: any): boolean {
  if (match.isPlaceholder) return false;
  if (match.status !== 'pending') return false;
  if (!match.player1_id || !match.player2_id) return false;
  if (tournament.status !== 'in_progress') return false;
  
  return true;
}

function getRoundTitle(roundNumber: number, totalRounds: number): string {
  if (roundNumber === totalRounds) return 'Final';
  if (roundNumber === totalRounds - 1) return 'Semi-Finals';
  if (roundNumber === totalRounds - 2) return 'Quarter-Finals';
  return `Round ${roundNumber}`;
}
