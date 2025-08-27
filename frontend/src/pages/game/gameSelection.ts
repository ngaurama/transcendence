export function playSelectionPage(): string {
  return `
    <div class="max-w-2xl mx-auto bg-gray-800 p-6 rounded-lg">
      <h2 class="text-2xl mb-6 text-center">Choose Your Game</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <button id="select-pong" class="bg-blue-500 p-4 rounded hover:bg-blue-600">
          <h3 class="text-xl">Pong</h3>
          <p class="text-sm text-gray-300">Classic paddle game</p>
        </button>
      </div>
      
      <div id="mode-selection" class="hidden">
        <h3 class="text-xl mb-4">Choose Mode</h3>
        <select id="game-mode" class="w-full p-2 bg-gray-700 rounded mb-4">
          <option value="online">Online (Matchmaking)</option>
          <option value="local">Local (Two Player)</option>
          <option value="ai" disabled>Single Player vs AI (Coming soon)</option>
        </select>
        
        <div id="options-panel" class="mb-4">
          <label class="block mb-2">Points to Win:</label>
          <select id="points-to-win" class="w-full p-2 bg-gray-700 rounded mb-2">
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="15">15</option>
          </select>
          
          <label class="block mb-2">Powerups:</label>
          <select id="powerups" class="w-full p-2 bg-gray-700 rounded mb-2">
            <option value="false">Disabled</option>
            <option value="true">Enabled</option>
          </select>
          
          <label class="block mb-2">Board Variant:</label>
          <select id="board-variant" class="w-full p-2 bg-gray-700 rounded">
            <option value="classic">Classic</option>
            <option value="neon">Neon</option>
            <option value="space">Space</option>
          </select>
        </div>

        <div id="local-options" class="hidden mb-4">
          <label class="block mb-2">Opponent Alias:</label>
          <input id="opponent-alias" class="w-full p-2 bg-gray-700 rounded" placeholder="Opponent's name">
        </div>
        
        <button id="start-game" class="w-full bg-green-500 p-2 rounded">Start Game</button>
        <p class="text-center my-2">or</p>
        <button id="create-tournament" class="w-full bg-purple-500 p-2 rounded opacity-50 cursor-not-allowed" disabled>Create Tournament</button>
      </div>
    </div>
  `;
}

export function attachPlaySelectionListeners() {
  const selectPong = document.getElementById('select-pong');
  const modeSelection = document.getElementById('mode-selection');
  const gameMode = document.getElementById('game-mode') as HTMLSelectElement;
  const optionsPanel = document.getElementById('options-panel');
  const localOptions = document.getElementById('local-options');
  const startGame = document.getElementById('start-game');

  if (selectPong && modeSelection) {
    selectPong.addEventListener('click', () => modeSelection.classList.remove('hidden'));
  }

  if (gameMode) {
    gameMode.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value;
      if (optionsPanel) {
        if (value === 'tournament') {
          optionsPanel.classList.add('hidden');
        } else {
          optionsPanel.classList.remove('hidden');
        }
      }
      if (localOptions) {
        if (value === 'local') {
          localOptions.classList.remove('hidden');
        } else {
          localOptions.classList.add('hidden');
        }
      }
    });
  }

  if (startGame) {
    startGame.addEventListener('click', async () => {
      const mode = gameMode.value;
      const points = parseInt((document.getElementById('points-to-win') as HTMLSelectElement).value);
      const powerups = (document.getElementById('powerups') as HTMLSelectElement).value === 'true';
      const variant = (document.getElementById('board-variant') as HTMLSelectElement).value;
      let opponent_alias = '';

      if (mode === 'local') {
        opponent_alias = (document.getElementById('opponent-alias') as HTMLInputElement).value || 'Player 2';
      }

      try {
        const token = localStorage.getItem('access_token');
        let res;
        
        if (mode === 'online') {
          // Matchmaking
          res = await fetch(`/api/game/matchmaking/join`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json', 
              'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ 
              game_type: 'pong', 
              skill_range: 'any',
              points_to_win: points,
              power_ups_enabled: powerups,
              map_variant: variant
            })
          });
        } else if (mode === 'tournament') {
          // Tournament
          res = await fetch(`/api/game/tournament/create`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json', 
              'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ 
              name: 'My Tournament', 
              max_participants: 8, 
              tournament_type: 'single_elimination', 
              game_type: 'pong',
              points_to_win: points,
              power_ups_enabled: powerups,
              map_variant: variant
            })
          });
        } else {
          // Local game
          res = await fetch(`/api/pong/game/create`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json', 
              'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ 
              is_private: mode === 'local',
              max_players: 2,
              power_ups_enabled: powerups,
              map_variant: variant,
              points_to_win: points,
              opponent_alias: opponent_alias
            })
          });
        }

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
        }

        const data = await res.json();
        if (data.success) {
          if (mode === 'local') {
            (window as any).gameOptions = {
              mode: 'local',
              points: points,
              powerups: powerups,
              variant: variant,
              opponent_alias: opponent_alias
            };
          }
          (window as any).navigate(`/game/pong?game_id=${data.game_id || data.tournament_id}`);
        } else {
          alert(data.error || 'Failed to start game');
        }
      } catch (error) {
        console.error('Failed to start game:', error);
        alert(error || 'Failed to start game');
      }
    });
  }
}
