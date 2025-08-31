// pages/gameSelection.ts
import { getOpenTournaments, joinTournament } from '../../services/PongService';
import { startGame } from '../../services/GameService'
import { saveGameOptions, getGameOptions } from '../../services/GameOptionsService';
import { checkAuthStatus } from '../../services';

let currentTournamentMode: string = '';
const user = await checkAuthStatus();


export async function playSelectionPage(): Promise<string> {
  if (!user) {
    (window as any).navigate('/login');
    return '';
  }
  const openTournaments = await getOpenTournaments();

  return `
    <div class="max-w-2xl mx-auto bg-gray-800 p-6 rounded-lg">
      <h2 class="text-2xl mb-6 text-center">Choose Your Game</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <button id="select-pong" class="bg-blue-500 p-4 rounded hover:bg-blue-600">
          <h3 class="text-xl">Pong</h3>
          <p class="text-sm text-gray-300">Classic paddle game</p>
        </button>
        <button id="select-none" class="bg-green-500 p-4 rounded hover:bg-green-600 opacity-50 cursor-not-allowed">
          <h3 class="text-xl">Another Game</h3>
          <p class="text-sm text-gray-300">Coming soon</p>
        </button>
      </div>
      
      <div id="mode-selection" class="hidden">
        <h3 class="text-xl mb-4">Choose How to Play</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button id="play-online" class="bg-purple-600 p-4 rounded hover:bg-purple-700">
            <h4 class="text-lg">Play Online</h4>
            <p class="text-sm text-gray-300">Match with other players</p>
          </button>
          <button id="play-local" class="bg-orange-600 p-4 rounded hover:bg-orange-700">
            <h4 class="text-lg">Play Local</h4>
            <p class="text-sm text-gray-300">Multiple players on same device</p>
          </button>
        </div>

        <!-- Game Settings (Common for both modes) -->
        <div id="game-options" class="mb-4 hidden">
          <h4 class="text-lg mb-3">Game Settings</h4>
          <label class="block mb-2">Points to Win:</label>
          <select id="points-to-win" class="w-full p-2 bg-gray-700 rounded mb-3">
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="15">15</option>
          </select>
          
          <label class="block mb-2">Powerups:</label>
          <select id="powerups" class="w-full p-2 bg-gray-700 rounded mb-3">
            <option value="false">Disabled</option>
            <option value="true">Enabled</option>
          </select>
          
          <label class="block mb-2">Board Variant:</label>
          <select id="board-variant" class="w-full p-2 bg-gray-700 rounded mb-4">
            <option value="classic">Classic</option>
            <option value="neon">Neon</option>
            <option value="space">Space</option>
          </select>

          <div class="flex space-x-4">
            <button id="back-to-mode" class="flex-1 bg-gray-600 p-3 rounded hover:bg-gray-700">
              ← Back
            </button>
            <button id="confirm-settings" class="flex-1 bg-green-600 p-3 rounded hover:bg-green-700">
              Confirm Settings
            </button>
          </div>
        </div>

        <!-- Online Mode Options -->
        <div id="online-options" class="mb-4 hidden">
          <h4 class="text-lg mb-3">Online Play Options</h4>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <button id="start-matchmaking" class="bg-green-600 p-4 rounded hover:bg-green-700">
              <h5 class="font-semibold">Start Matchmaking</h5>
              <p class="text-sm">Find a random opponent</p>
            </button>
            <button id="online-create-tournament" class="bg-blue-600 p-4 rounded hover:bg-blue-700">
              <h5 class="font-semibold">Create Tournament</h5>
              <p class="text-sm">Host a tournament</p>
            </button>
            <button id="join-tournament" class="bg-purple-600 p-4 rounded hover:bg-purple-700">
              <h5 class="font-semibold">Join Tournament</h5>
              <p class="text-sm">Join an open tournament</p>
            </button>
          </div>
          <button id="back-to-settings-online" class="w-full bg-gray-600 p-2 rounded hover:bg-gray-700">
            ← Back to Settings
          </button>
        </div>

        <!-- Local Mode Options -->
        <div id="local-options" class="mb-4 hidden">
          <h4 class="text-lg mb-3">Local Play Options</h4>
          <div class="grid grid-cols-1 gap-4 mb-4">
            <button id="start-local-game" class="bg-green-600 p-4 rounded hover:bg-green-700">
              <h5 class="font-semibold">Start 2-Player Game</h5>
              <p class="text-sm">Play against one opponent</p>
            </button>
            <button id="local-create-tournament" class="bg-blue-600 p-4 rounded hover:bg-blue-700">
              <h5 class="font-semibold">Create Tournament</h5>
              <p class="text-sm">4+ players bracket</p>
            </button>
          </div>
          <button id="back-to-settings-local" class="w-full bg-gray-600 p-2 rounded hover:bg-gray-700">
            ← Back to Settings
          </button>
        </div>

        <!-- Local 2-Player Confirmation -->
        <div id="local-confirmation" class="mb-4 hidden">
          <h4 class="text-lg mb-3">Start 2-Player Game</h4>
          <div class="mb-4">
            <label for="opponent-alias" class="block mb-2">Opponent Alias:</label>
            <input
              type="text"
              id="opponent-alias"
              placeholder="Enter opponent name"
              class="w-full p-2 bg-gray-700 rounded mb-3"
              value="Player 2"
            />
          </div>
          <div class="flex space-x-4">
            <button id="back-from-local-confirm" class="flex-1 bg-gray-600 p-3 rounded hover:bg-gray-700">
              ← Back
            </button>
            <button id="confirm-local-game" class="flex-1 bg-green-600 p-3 rounded hover:bg-green-700">
              Start Game
            </button>
          </div>
        </div>

        <!-- Tournament Creation (Common for both modes) -->
        <div id="tournament-creation" class="mb-4 hidden">
          <h4 class="text-lg mb-3">Create Tournament</h4>
          
          <label class="block mb-2">Tournament Name:</label>
          <input id="tournament-name" class="w-full p-2 bg-gray-700 rounded mb-3" placeholder="My Tournament">
          
          <label class="block mb-2">Number of Players:</label>
          <select id="tournament-num-players" class="w-full p-2 bg-gray-700 rounded mb-3">
            <option value="4">4 Players</option>
            <option value="8">8 Players</option>
            <option value="16">16 Players</option>
          </select>

          <!-- Player aliases section - will be shown/hidden based on tournament type -->
          <div id="player-aliases-container" class="mb-4">
            <div id="player-aliases"></div>
          </div>

          <div class="flex space-x-4">
            <button id="back-from-tournament" class="flex-1 bg-gray-600 p-3 rounded hover:bg-gray-700">
              ← Back
            </button>
            <button id="create-tournament" class="flex-1 bg-green-600 p-3 rounded hover:bg-green-700">
              Create Tournament
            </button>
          </div>
        </div>

        <!-- Join Tournament Section (Online only) -->
        <div id="join-tournament-section" class="mb-4 hidden">
          <h4 class="text-lg mb-3">Join Tournament</h4>
          <div id="open-tournaments-list" class="mb-4">
            ${openTournaments.length > 0
              ? `<ul class="space-y-2">
                  ${openTournaments.map(t => `
                    <li class="bg-gray-700 p-3 rounded flex justify-between items-center">
                      <div>
                        <span class="font-semibold">${t.name}</span>
                        <p class="text-sm text-gray-300">${t.current_participants}/${t.max_participants} players</p>
                      </div>
                      <button class="join-tournament-btn bg-blue-500 px-3 py-1 rounded text-sm" data-id="${t.id}">Join</button>
                    </li>
                  `).join('')}
                </ul>`
              : '<p class="text-gray-400 text-center py-4">No open tournaments available</p>'
            }
          </div>
          <button id="back-from-join" class="w-full bg-gray-600 p-2 rounded hover:bg-gray-700">
            ← Back to Online Options
          </button>
        </div>
      </div>
    </div>
  `;
}

export function attachPlaySelectionListeners() {
  const selectPong = document.getElementById('select-pong');
  const modeSelection = document.getElementById('mode-selection');
  const playOnline = document.getElementById('play-online');
  const playLocal = document.getElementById('play-local');
  const gameOptions = document.getElementById('game-options');
  const onlineOptions = document.getElementById('online-options');
  const localOptions = document.getElementById('local-options');
  const localConfirmation = document.getElementById('local-confirmation');
  const tournamentCreation = document.getElementById('tournament-creation');
  const joinTournamentSection = document.getElementById('join-tournament-section');
  const playerAliasesContainer = document.getElementById('player-aliases-container');

  // Buttons
  const confirmSettings = document.getElementById('confirm-settings');
  const backToMode = document.getElementById('back-to-mode');
  const startMatchmaking = document.getElementById('start-matchmaking');
  const onlineCreateTournament = document.getElementById('online-create-tournament');
  const startLocalGame = document.getElementById('start-local-game');
  const localCreateTournament = document.getElementById('local-create-tournament');
  const backToSettingsOnline = document.getElementById('back-to-settings-online');
  const backToSettingsLocal = document.getElementById('back-to-settings-local');
  const backFromLocalConfirm = document.getElementById('back-from-local-confirm');
  const confirmLocalGame = document.getElementById('confirm-local-game');
  const backFromTournament = document.getElementById('back-from-tournament');
  const createTournamentBtn = document.getElementById('create-tournament');
  const backFromJoin = document.getElementById('back-from-join');
  const tournamentNumPlayers = document.getElementById('tournament-num-players') as HTMLSelectElement;
  const joinTournamentBtn = document.getElementById('join-tournament');

  let currentMode: string = '';

  // Load saved options
  const savedOptions = getGameOptions();
  if (savedOptions.points_to_win) {
    const pointsSelect = document.getElementById('points-to-win') as HTMLSelectElement;
    if (pointsSelect) pointsSelect.value = savedOptions.points_to_win.toString();
  }
  if (savedOptions.powerups_enabled !== undefined) {
    const powerupsSelect = document.getElementById('powerups') as HTMLSelectElement;
    if (powerupsSelect) powerupsSelect.value = savedOptions.powerups_enabled.toString();
  }
  if (savedOptions.board_variant) {
    const variantSelect = document.getElementById('board-variant') as HTMLSelectElement;
    if (variantSelect) variantSelect.value = savedOptions.board_variant;
  }

  // Main navigation
  if (selectPong && modeSelection) {
    selectPong.addEventListener('click', () => {
      modeSelection.classList.remove('hidden');
    });
  }

  // Mode selection
  if (playOnline && playLocal) {
    playOnline.addEventListener('click', () => {
      currentMode = 'online';
      gameOptions?.classList.remove('hidden');
      onlineOptions?.classList.add('hidden');
      localOptions?.classList.add('hidden');
      localConfirmation?.classList.add('hidden');
      tournamentCreation?.classList.add('hidden');
      joinTournamentSection?.classList.add('hidden');
      playOnline.classList.add('ring-2', 'ring-white');
      playLocal.classList.remove('ring-2', 'ring-white');
    });

    playLocal.addEventListener('click', () => {
      currentMode = 'local';
      gameOptions?.classList.remove('hidden');
      onlineOptions?.classList.add('hidden');
      localOptions?.classList.add('hidden');
      localConfirmation?.classList.add('hidden');
      tournamentCreation?.classList.add('hidden');
      joinTournamentSection?.classList.add('hidden');
      playLocal.classList.add('ring-2', 'ring-white');
      playOnline.classList.remove('ring-2', 'ring-white');
    });
  }

  // Settings navigation
  if (confirmSettings) {
    confirmSettings.addEventListener('click', () => {
      gameOptions?.classList.add('hidden');
      if (currentMode === 'online') {
        onlineOptions?.classList.remove('hidden');
      } else {
        localOptions?.classList.remove('hidden');
      }
    });
  }

  if (backToMode) {
    backToMode.addEventListener('click', () => {
      gameOptions?.classList.add('hidden');
      onlineOptions?.classList.add('hidden');
      localOptions?.classList.add('hidden');
      localConfirmation?.classList.add('hidden');
      tournamentCreation?.classList.add('hidden');
      joinTournamentSection?.classList.add('hidden');
    });
  }

  // Online options
  if (startMatchmaking) {
    startMatchmaking.addEventListener('click', () => {
      handleStartGame('online', '2player');
    });
  }

  if (onlineCreateTournament) {
    onlineCreateTournament.addEventListener('click', () => {
      currentTournamentMode = 'online';
      onlineOptions?.classList.add('hidden');
      tournamentCreation?.classList.remove('hidden');
      // Hide player aliases for online tournaments
      if (playerAliasesContainer) playerAliasesContainer.classList.add('hidden');
    });
  }

  if (joinTournamentBtn) {
    joinTournamentBtn.addEventListener('click', () => {
      onlineOptions?.classList.add('hidden');
      joinTournamentSection?.classList.remove('hidden');
    });
  }

  if (backToSettingsOnline) {
    backToSettingsOnline.addEventListener('click', () => {
      onlineOptions?.classList.add('hidden');
      gameOptions?.classList.remove('hidden');
    });
  }

  // Local options
  if (startLocalGame) {
    startLocalGame.addEventListener('click', () => {
      localOptions?.classList.add('hidden');
      localConfirmation?.classList.remove('hidden');       // handleStartGame('local', '2player');
    });
  }

  if (localCreateTournament) {
    localCreateTournament.addEventListener('click', () => {
      currentTournamentMode = 'local';
      localOptions?.classList.add('hidden');
      tournamentCreation?.classList.remove('hidden');
      if (playerAliasesContainer) 
        playerAliasesContainer.classList.remove('hidden');
      updatePlayerAliases();
    });
  }

  if (backToSettingsLocal) {
    backToSettingsLocal.addEventListener('click', () => {
      localOptions?.classList.add('hidden');
      gameOptions?.classList.remove('hidden');
    });
  }

  // Local confirmation
  if (backFromLocalConfirm) {
    backFromLocalConfirm.addEventListener('click', () => {
      localConfirmation?.classList.add('hidden');
      localOptions?.classList.remove('hidden');
    });
  }

  if (confirmLocalGame) {
    confirmLocalGame.addEventListener('click', () => {
      handleStartGame('local', '2player');
    });
  }

  // Tournament creation
  if (tournamentNumPlayers) {
    tournamentNumPlayers.addEventListener('change', () => {
      if (currentTournamentMode === 'local') {
        updatePlayerAliases();
      }
    });
  }

  if (backFromTournament) {
    backFromTournament.addEventListener('click', () => {
      tournamentCreation?.classList.add('hidden');
      if (currentTournamentMode === 'online') {
        onlineOptions?.classList.remove('hidden');
      } else {
        localOptions?.classList.remove('hidden');
      }
    });
  }

  if (createTournamentBtn) {
    createTournamentBtn.addEventListener('click', () => {
      if (currentTournamentMode === 'local')
        handleStartGame('local', 'tournament');
      else
        handleStartGame('online', 'tournament');
    });
  }

  // Join tournament
  if (backFromJoin) {
    backFromJoin.addEventListener('click', () => {
      joinTournamentSection?.classList.add('hidden');
      onlineOptions?.classList.remove('hidden');
    });
  }

  // Tournament joining
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

  if (playerAliasesContainer) {
    playerAliasesContainer.classList.add('hidden');
  }
}

function updatePlayerAliases() {
  const numPlayersSelect = document.getElementById('tournament-num-players') as HTMLSelectElement;
  const playerAliasesDiv = document.getElementById('player-aliases');
  if (!numPlayersSelect || !playerAliasesDiv) return;

  const numPlayers = parseInt(numPlayersSelect.value) || 4;
  playerAliasesDiv.innerHTML = `
    <label class="block mb-2">Player Aliases:</label>
    ${Array.from({ length: numPlayers }, (_, i) => `
      <div class="mb-2">
        <label class="text-sm text-gray-400">Player ${i + 1}:</label>
        <input id="alias-${i}" class="w-full p-2 bg-gray-700 rounded" placeholder="Player ${i + 1} name" value="Player ${i + 1}">
      </div>
    `).join('')}
  `;
}

async function handleStartGame(gameMode: string, gameType: string): Promise<void> {
  const points_to_win = parseInt((document.getElementById('points-to-win') as HTMLSelectElement)?.value || '5');
  const powerups_enabled = (document.getElementById('powerups') as HTMLSelectElement)?.value === 'true';
  const board_variant = (document.getElementById('board-variant') as HTMLSelectElement)?.value || 'classic';
  
  let tournament_name = '';
  let max_participants = 8;
  let num_players = 4;
  let aliases: string[] = [];

  if (gameType === 'tournament') {
    tournament_name = (document.getElementById('tournament-name') as HTMLInputElement)?.value || 'My Tournament';
    num_players = parseInt((document.getElementById('tournament-num-players') as HTMLSelectElement)?.value || '4');
    max_participants = num_players;
    
    if (gameMode === 'local') {
      aliases = Array.from({ length: num_players }, (_, i) => {
        const input = document.getElementById(`alias-${i}`) as HTMLInputElement;
        return input?.value || `Player ${i + 1}`;
      });
    }
  }

  const options: any = {
    gameMode,
    gameType,
    points_to_win,
    powerups_enabled,
    board_variant,
    name: tournament_name,
    max_participants,
    num_players,
    aliases,
    tournament_type: 'single_elimination',
  };
  
  const opponentAliasInput = document.getElementById('opponent-alias') as HTMLInputElement;

  if (gameMode === 'local') {
    options.player1_name = user?.display_name || 'Player 1';
    options.player2_name = opponentAliasInput?.value.trim() || 'Player 2';
  }

  saveGameOptions({
    gameMode: gameMode,
    gameType: gameType,
    points_to_win,
    powerups_enabled,
    board_variant,
    player1_name: user?.display_name || 'Player 1',
    player2_name: gameMode === 'local' ? opponentAliasInput?.value.trim() || 'Player 2' : undefined,
  });

  try {
    const id = await startGame(options);
    if (gameType === 'tournament') {
      (window as any).gameOptions = options;
      (window as any).navigate(`/tournament/${id}`);
    } else if (gameMode === 'local') {
      (window as any).gameOptions = options;
      (window as any).navigate(`/game/pong?game_id=${id}`);
    } else if (gameMode === 'online') {
      alert('Joined matchmaking queue. Waiting for opponent...');
    }
  } catch (error) {
    console.error('Failed to start game:', error);
    alert(error instanceof Error ? error.message : 'Failed to start game');
  }
}
