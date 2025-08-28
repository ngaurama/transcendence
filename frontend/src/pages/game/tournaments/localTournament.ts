// localTournament.ts
export function localTournamentPage(): string {
  return `
    <div class="max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
      <h2 class="text-2xl mb-4">Create Local Tournament</h2>
      <form id="local-tournament-form" class="space-y-4">
        <label class="block">Tournament Name:
          <input type="text" id="tournament-name" class="w-full p-2 bg-gray-700 rounded" required>
        </label>
        <label class="block">Number of Players (4-16):
          <input type="number" id="num-players" min="4" max="16" class="w-full p-2 bg-gray-700 rounded" required>
        </label>
        <label class="block">Tournament Type:
          <select id="tournament-type" class="w-full p-2 bg-gray-700 rounded">
            <option value="single_elimination">Single Elimination</option>
            <option value="round_robin">Round Robin</option>
          </select>
        </label>
        <label class="block">Powerups:
          <select id="powerups" class="w-full p-2 bg-gray-700 rounded">
            <option value="false">Disabled</option>
            <option value="true">Enabled</option>
          </select>
        </label>
        <label class="block">Points to Win:
          <select id="points-to-win" class="w-full p-2 bg-gray-700 rounded">
            <option value="5">5</option>
            <option value="10">10</option>
          </select>
        </label>
        <label class="block">Board Variant:
          <select id="board-variant" class="w-full p-2 bg-gray-700 rounded">
            <option value="classic">Classic</option>
            <option value="neon">Neon</option>
          </select>
        </label>
        <button type="submit" class="w-full bg-green-500 p-2 rounded">Create Tournament</button>
      </form>
    </div>
  `;
}

export function attachLocalTournamentListeners() {
  const form = document.getElementById('local-tournament-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const numPlayers = parseInt((document.getElementById('num-players') as HTMLInputElement).value);
      let aliasesHtml = '';
      for (let i = 1; i <= numPlayers; i++) {
        aliasesHtml += `
          <label class="block">Player ${i} Alias:
            <input type="text" data-player="${i}" class="alias-input w-full p-2 bg-gray-700 rounded" required>
          </label>
        `;
      }
      const aliasesForm = `
        <div class="max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
          <h2 class="text-2xl mb-4">Enter Player Aliases</h2>
          <form id="aliases-form" class="space-y-4">
            ${aliasesHtml}
            <button type="submit" class="w-full bg-green-500 p-2 rounded">Start Tournament</button>
          </form>
        </div>
      `;
      document.getElementById('app')!.innerHTML = aliasesForm;
      attachAliasesListeners(); // New function to handle aliases submission and start tournament
    });
  }
}

// New: Handle aliases and start client-side tournament
function attachAliasesListeners() {
  const form = document.getElementById('aliases-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const aliases = Array.from(document.querySelectorAll('.alias-input')).map(input => (input as HTMLInputElement).value);
      // Store tournament config in localStorage or var, start first match
      startLocalTournament(aliases, { /* options from form */ });
    });
  }
}

// Placeholder for client-side tournament logic
function startLocalTournament(aliases: string[], options: any) {
  // Implement bracket: array of matches, current match, play game, record winner, advance
  // When match starts, navigate to pongGamePage with local mode, on end, record score, show next match
  // Use single elimination: pair players, winners advance
  let bracket = generateBracket(aliases);
  playNextMatch(bracket);
}

function generateBracket(players: string[]) {
  // Simple single elimination pairing
  const matches = [];
  for (let i = 0; i < players.length; i += 2) {
    matches.push({ player1: players[i], player2: players[i+1] || 'Bye', winner: null });
  }
  return matches;
}

function playNextMatch(bracket: any[]) {
  const nextMatch = bracket.find(m => !m.winner);
  if (!nextMatch) {
    alert('Tournament over!');
    return;
  }
  // Navigate to pong with local, on win callback record winner, recurse
  (window as any).navigate('/game/pong?mode=local'); // Add params for match info
  // In pong endGame, check if tournament, record winner, call playNextMatch
}
