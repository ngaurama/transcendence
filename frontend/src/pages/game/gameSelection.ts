import { getOpenTournaments, joinTournament, deleteTournament } from '../../services/PongService';
import { startGame } from '../../services/GameService';
import { saveGameOptions, getGameOptions } from '../../services/GameOptionsService';
import { checkAuthStatus } from '../../services';

let currentTournamentMode: string = '';
let matchmakingCleanup: (() => void) | null = null;

export async function playSelectionPage(): Promise<string> {
  const user = await checkAuthStatus();
  if (!user) {
    (window as any).navigate('/');
    return '';
  }
  const openTournaments = await getOpenTournaments();

  return `
    <div class="glass-card max-w-2xl mx-auto bg-gray-800 p-6 rounded-xl">
      <h2 class="text-2xl mb-6 text-center">Choose Your Game</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <button id="F-pong" class="glass-button bg-blue-600 p-4 rounded hover:bg-blue-600">
          <h3 class="text-xl">Pong</h3>
          <p class="text-md text-gray-300">Classic paddle game</p>
        </button>
        <button id="select-none" class="glass-button disabled bg-green-500 p-4 rounded opacity-50 cursor-not-allowed">
          <h3 class="text-xl">Another Game</h3>
          <p class="text-md text-gray-300">Coming soon</p>
        </button>
      </div>
      
      <div id="mode-selection" class="hidden">
        <h3 class="text-xl mb-4">Choose How to Play</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button id="play-online" class="bg-purple-600 p-4 rounded-xl hover:bg-purple-700">
            <h4 class="text-xl">Play Online</h4>
            <p class="text-md text-gray-300">Match with other players</p>
          </button>
          <button id="play-local" class="bg-orange-600 p-4 rounded-xl hover:bg-orange-700">
            <h4 class="text-xl">Play Local</h4>
            <p class="text-md text-gray-300">Multiple players on same device</p>
          </button>
        </div>

        <!-- Game Settings (Common for both modes) -->
        <div id="game-options" class="mb-4 hidden">
          <h4 class="text-xl mb-3">Game Settings</h4>
          <label class="block mb-2">Points to Win:</label>
          <select id="points-to-win" class="glass-dropdown w-full p-2 bg-gray-700 rounded mb-3">
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="15">15</option>
          </select>
          
          <label class="block mb-2">Powerups:</label>
          <select id="powerups" class="glass-dropdown w-full p-2 bg-gray-700 rounded mb-3">
            <option value="false">Disabled</option>
            <option value="true">Enabled</option>
          </select>
          
          <label class="block mb-2">Board Variant:</label>
          <select id="board-variant" class="glass-dropdown w-full p-2 bg-gray-700 rounded mb-4">
            <option value="classic">Classic</option>
            <option value="neon">Neon</option>
            <option value="space">Space</option>
          </select>

          <div class="flex space-x-4">
            <button id="back-to-mode" class="glass-button flex-1 bg-gray-600 p-3 rounded hover:bg-gray-700">
              ← Back
            </button>
            <button id="confirm-settings" class="glass-button flex-1 bg-green-600 p-3 rounded hover:bg-green-700">
              Confirm Settings
            </button>
          </div>
        </div>

        <!-- Online Mode Options -->
        <div id="online-options" class="mb-4 hidden">
          <h4 class="text-xl mb-3">Online Play Options</h4>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <button id="start-matchmaking" class="glass-button  bg-green-600 p-4 rounded hover:bg-green-700 relative group transition-all duration-300">
              <div id="matchmaking-content" class="text-center">
                <h5 class="font-semibold">Start Matchmaking</h5>
                <p class="text-sm text-gray-300">Find a random opponent</p>
              </div>
              <div 
                id="matchmaking-loading" 
                class="hidden absolute inset-0 rounded-[inherit] bg-green-700 rounded flex flex-col items-center justify-center transition-opacity duration-300">
                <div class="loader-state flex flex-col items-center group-hover:hidden">
                  <svg class="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span class="mt-2 text-white">Waiting for match...</span>
                </div>
                <div class="cancel-state hidden group-hover:flex flex-col items-center">
                  <span id="cancel-matchmaking" class="cursor-pointer">
                    <svg class="w-6 h-6 text-red-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </span>
                  <span class="mt-1 text-red-300">Cancel Matchmaking</span>
                </div>
              </div>
            </button>
            <button id="online-create-tournament" class="glass-button bg-blue-600 p-4 rounded hover:bg-blue-700">
              <h5 class="font-semibold">Create Tournament</h5>
              <p class="text-sm text-gray-300">Host a tournament</p>
            </button>
            <button id="join-tournament" class="glass-button bg-purple-600 p-4 rounded hover:bg-purple-700">
              <h5 class="font-semibold">Join Tournament</h5>
              <p class="text-sm text-gray-300">Join an open tournament</p>
            </button>
          </div>
          <button id="back-to-settings-online" class="glass-button w-full bg-gray-600 p-2 rounded hover:bg-gray-700">
            ← Back to Settings
          </button>
        </div>

        <!-- Local Mode Options -->
        <div id="local-options" class="mb-4 hidden">
          <h4 class="text-xl mb-3">Local Play Options</h4>
          <div class="grid grid-cols-1 gap-4 mb-4">
            <button id="start-local-game" class="glass-button bg-green-600 p-4 rounded hover:bg-green-700">
              <h5 class="font-semibold text-xl">Start 2-Player Game</h5>
              <p class="text-md text-gray-300">Play against one opponent</p>
            </button>
            <button id="local-create-tournament" class="glass-button bg-blue-600 p-4 rounded hover:bg-blue-700">
              <h5 class="font-semibold text-xl">Create Tournament</h5>
              <p class="text-md text-gray-300">4+ players bracket</p>
            </button>
          </div>
          <button id="back-to-settings-local" class="glass-button w-full bg-gray-600 p-2 rounded hover:bg-gray-700">
            ← Back to Settings
          </button>
        </div>

        <!-- Local 2-Player Confirmation -->
        <div id="local-confirmation" class="mb-4 hidden">
          <h4 class="text-xl mb-3">Start 2-Player Game</h4>
          <div class="mb-4">
            <label for="opponent-alias" class="block mb-2">Opponent Alias:</label>
            <input
              type="text"
              id="opponent-alias"
              placeholder="Enter opponent name"
              class="glass-input w-full p-2 bg-gray-700 rounded mb-3"
              value="Player 2"
            />
          </div>
          <div class="flex space-x-4">
            <button id="back-from-local-confirm" class="glass-button flex-1 bg-gray-600 p-3 rounded hover:bg-gray-700">
              ← Back
            </button>
            <button id="confirm-local-game" class="glass-button flex-1 bg-green-600 p-3 rounded hover:bg-green-700">
              Start Game
            </button>
          </div>
        </div>

        <!-- Tournament Creation (Common for both modes) -->
        <div id="tournament-creation" class="mb-4 hidden">
          <h4 class="text-xl mb-3">Create Tournament</h4>
          
          <label class="block mb-2">Tournament Name:</label>
          <input id="tournament-name" class="glass-input w-full p-2 bg-gray-700 rounded mb-3" placeholder="My Tournament">
          
          <label class="block mb-2">Number of Players:</label>
          <select id="tournament-num-players" class="glass-dropdown w-full p-2 bg-gray-700 rounded mb-3">
            <option value="4">4 Players</option>
            <option value="8">8 Players</option>
            <option value="16">16 Players</option>
          </select>

          <!-- Player aliases section - will be shown/hidden based on tournament type -->
          <div id="player-aliases-container" class="mb-4">
            <div id="player-aliases"></div>
          </div>

          <div class="flex space-x-4">
            <button id="back-from-tournament" class="glass-button flex-1 bg-gray-600 p-3 rounded hover:bg-gray-700">
              ← Back
            </button>
            <button id="create-tournament" class="glass-button flex-1 bg-green-600 p-3 rounded hover:bg-green-700">
              Create Tournament
            </button>
          </div>
        </div>

        <!-- Join Tournament Section (Online only) -->
        <div id="join-tournament-section" class="mb-4 hidden">
          <h4 class="text-xl mb-3">Join Tournament</h4>
          <div id="open-tournaments-list" class="mb-4">
            ${openTournaments.length > 0
              ? `<ul class="space-y-2">
                  ${openTournaments.map(t => {
                    const settings = t.tournament_settings || {};
                    const isCreator = user && t.creator_id === user.id;
                    
                    return `
                    <li class="glass-card bg-gray-700 p-3 rounded" data-id="${t.id}">
                      <div class="flex justify-between items-start mb-2">
                        <div class="flex-1">
                          <span class="font-semibold">${t.name}</span>
                          <p class="text-xs text-gray-300 mt-1">
                            ${settings.powerups_enabled ? 'Powerups: Yes' : 'Powerups: No'} | 
                            ${settings.points_to_win || 5} points | 
                            ${settings.board_variant || 'Classic'}
                          </p>
                          <p class="text-sm text-gray-300 mt-1">${t.current_participants}/${t.max_participants} players</p>
                        </div>
                        <div class="flex flex-col items-end space-y-2">
                          ${isCreator 
                            ? `<button class="glass-button delete-tournament-btn bg-red-500 px-3 py-1 rounded text-sm" data-id="${t.id}">Delete</button>` 
                            : ''
                          }
                          <button class="glass-button join-tournament-btn bg-blue-500 px-3 py-1 rounded text-sm" data-id="${t.id}">
                            ${isCreator ? 'Manage' : 'Join'}
                          </button>
                        </div>
                      </div>
                    </li>
                    `;
                  }).join('')}
                </ul>`
              : '<p class="text-gray-400 text-center py-4">No open tournaments available</p>'
            }
          </div>
          <button id="back-from-join" class="glass-button w-full bg-gray-600 p-2 rounded hover:bg-gray-700">
            ← Back to Online Options
          </button>
        </div>
      </div>
    </div>
  `;
}

export async function attachPlaySelectionListeners() {
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
  const cancelMatchmakingBtn = document.getElementById('cancel-matchmaking');

  let isInMatchmaking = false;
  let matchmakingInterval: number | null = null;
  let currentMode: string = '';

  const user = await checkAuthStatus();
  if (!user)
    return;

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

  if (selectPong && modeSelection) {
    selectPong.addEventListener('click', () => {
      modeSelection.classList.remove('hidden');
    });
  }

  if (playOnline && playLocal) {
    playOnline.addEventListener('click', () => {
      currentMode = 'online';
      gameOptions?.classList.remove('hidden');
      onlineOptions?.classList.add('hidden');
      localOptions?.classList.add('hidden');
      localConfirmation?.classList.add('hidden');
      tournamentCreation?.classList.add('hidden');
      joinTournamentSection?.classList.add('hidden');
      playLocal.classList.remove('select-btn-border');
      playOnline.classList.add('select-btn-border');
      playLocal.classList.add('opacity-50');
      playOnline.classList.remove('opacity-50');
      // playOnline.classList.add('ring-2', 'ring-white');
      // playLocal.classList.remove('ring-2', 'ring-white');
    });

    playLocal.addEventListener('click', () => {
      currentMode = 'local';
      gameOptions?.classList.remove('hidden');
      onlineOptions?.classList.add('hidden');
      localOptions?.classList.add('hidden');
      localConfirmation?.classList.add('hidden');
      tournamentCreation?.classList.add('hidden');
      joinTournamentSection?.classList.add('hidden');
      // playLocal.classList.add('ring-2', 'ring-white');
      // playOnline.classList.remove('ring-2', 'ring-white');
      playLocal.classList.add('select-btn-border');
      playOnline.classList.remove('select-btn-border');
      playOnline.classList.add('opacity-50');
      playLocal.classList.remove('opacity-50');
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
      if (isInMatchmaking) return;
      startMatchmakingProcess();
    });
  }

  if (cancelMatchmakingBtn) {
    cancelMatchmakingBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cancelMatchmaking();
    });
  }

  async function startMatchmakingProcess(): Promise<void> {
    try {
      isInMatchmaking = true;
      showMatchmakingLoading(true);
      matchmakingCleanup = () => {
        if (isInMatchmaking) {
          cancelMatchmaking();
        }
      }
      await handleStartGame(user, 'online', '2player');
      startMatchmakingPolling();
    } catch (error) {
      console.error('Matchmaking failed:', error);
      isInMatchmaking = false;
      showMatchmakingLoading(false);
      if (matchmakingCleanup) {
        matchmakingCleanup = null;
      }
      alert(error instanceof Error ? error.message : 'Failed to join matchmaking');
    }
  }

  function showMatchmakingLoading(show: boolean): void {
    const content = document.getElementById('matchmaking-content');
    const loading = document.getElementById('matchmaking-loading');
    const button = document.getElementById('start-matchmaking');
    
    if (content && loading && button) {
      if (show) {
        content.classList.add('hidden');
        loading.classList.remove('hidden');
        button.classList.add('cursor-not-allowed', 'opacity-90');
      } else {
        content.classList.remove('hidden');
        loading.classList.add('hidden');
        button.classList.remove('cursor-not-allowed', 'opacity-90');
      }
    }
  }

  function startMatchmakingPolling(): void {
    if (matchmakingInterval) {
      clearInterval(matchmakingInterval);
    }
    matchmakingInterval = window.setInterval(async () => {
      if (!isInMatchmaking) {
        clearInterval(matchmakingInterval!);
        return;
      }
      try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('/api/pong/matchmaking/status', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const status = await response.json();
          if (status.status !== 'searching') {
            cancelMatchmaking();
            if (status.game_id) {
              (window as any).gameOptions = getGameOptions();
              (window as any).navigate(`/game/pong?game_id=${status.game_id}`);
            }
          }
        }
      } catch (error) {
        console.error('Error checking matchmaking status:', error);
      }
    }, 5000);
  }

  async function cancelMatchmaking(): Promise<void> {
    try {
      isInMatchmaking = false;
      if (matchmakingInterval) {
        clearInterval(matchmakingInterval);
        matchmakingInterval = null;
      }
      
      showMatchmakingLoading(false);
      
      const token = localStorage.getItem('access_token');
      await fetch('/api/pong/matchmaking/leave', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}),      
      });
      console.log('Left matchmaking queue');
    } catch (error) {
      console.error('Error leaving matchmaking queue:', error);
      showMatchmakingLoading(false);
    } finally {
      if (matchmakingCleanup) {
        matchmakingCleanup = null;
      }
    }
  }

  function setupNavigationDetection() {
    const onlineOptions = document.getElementById('online-options');
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const isHidden = onlineOptions?.classList.contains('hidden');
          if (isHidden && isInMatchmaking) {
            // User navigated away from online options
            cancelMatchmaking();
          }
        }
      });
    });

    if (onlineOptions) {
      observer.observe(onlineOptions, { attributes: true });
    }

    return observer;
  }

  const originalNavigate = (window as any).navigate;
  (window as any).navigate = function(path: string) {
    // Clean up matchmaking before navigating
    if (matchmakingCleanup) {
      matchmakingCleanup();
      matchmakingCleanup = null;
    }
    originalNavigate.call(this, path);
  };

  window.addEventListener('beforeunload', () => {
    if (matchmakingCleanup) {
      matchmakingCleanup();
    }
    if (isInMatchmaking) {
      cancelMatchmaking();
    }
  });

  if (onlineCreateTournament) {
    onlineCreateTournament.addEventListener('click', () => {
      currentTournamentMode = 'online';
      onlineOptions?.classList.add('hidden');
      tournamentCreation?.classList.remove('hidden');
      if (playerAliasesContainer) playerAliasesContainer.classList.add('hidden');
    });
  }

  (window as any).addTournamentToList = function(tournament: any) {
    console.log("Adding new tournament dynamically:", tournament);
    const container = document.getElementById('open-tournaments-list');
    if (!container) {
      console.warn("No container for open tournaments found");
      return;
    }
    const noTournamentsMessage = container.querySelector('p.text-gray-400');
    if (noTournamentsMessage) {
      noTournamentsMessage.remove();
    }
    let tournamentsList = container.querySelector('ul');
    if (!tournamentsList) {
      tournamentsList = document.createElement('ul');
      tournamentsList.className = 'space-y-2';
      container.appendChild(tournamentsList);
    }

    if (tournamentsList.querySelector(`li[data-id="${tournament.id}"]`)) {
      console.warn(`Tournament ${tournament.id} already exists in the list`);
      return;
    }

    const settings = tournament.tournament_settings || {};
    const isCreator = user && tournament.creator_id === user.id;
    
    const tournamentHTML = `
      <li class="bg-gray-700 p-3 rounded" data-id="${tournament.id}">
        <div class="flex justify-between items-start mb-2">
          <div class="flex-1">
            <span class="font-semibold">${tournament.name}</span>
            <p class="text-xs text-gray-300 mt-1">
              ${settings.powerups_enabled ? 'Powerups: Yes' : 'Powerups: No'} | 
              ${settings.points_to_win || 5} points | 
              ${settings.board_variant || 'Classic'}
            </p>
            <p class="text-sm text-gray-300 mt-1">${tournament.current_participants}/${tournament.max_participants} players</p>
          </div>
          <div class="flex flex-col items-end space-y-2">
            ${isCreator 
              ? `<button class="delete-tournament-btn bg-red-500 px-3 py-1 rounded text-xs" data-id="${tournament.id}">Delete</button>` 
              : ''
            }
            <button class="join-tournament-btn bg-blue-500 px-3 py-1 rounded text-sm" data-id="${tournament.id}">
              ${isCreator ? 'Manage' : 'Join'}
            </button>
          </div>
        </div>
      </li>
    `;
    
    tournamentsList.insertAdjacentHTML('afterbegin', tournamentHTML);
    attachPlaySelectionListeners();
  };

  (window as any).updateTournamentParticipants = function(tournamentId: string, participants: any[]) {
    const tournamentItem = document.querySelector(`li[data-id="${tournamentId}"]`) as HTMLElement | null;
    if (tournamentItem) {
      const infoDiv = tournamentItem.querySelector('div > div.flex-1') as HTMLElement | null;
      if (infoDiv) {
        const settings = JSON.parse(tournamentItem.dataset.settings || '{}');
        
        const participantsText = document.createElement('p');
        participantsText.className = 'text-sm text-gray-300 mt-1';
        participantsText.textContent = `${participants.length}/${tournamentItem.dataset.maxParticipants} players`;
        
        const settingsText = document.createElement('p');
        settingsText.className = 'text-xs text-gray-300 mt-1';
        settingsText.innerHTML = `
          ${settings.powerups_enabled ? 'Powerups: Yes' : 'Powerups: No'} | 
          ${settings.points_to_win || 5} points | 
          ${settings.board_variant || 'Classic'}
        `;
        
        // Clear existing content and add updated content
        const nameElement = tournamentItem.querySelector('.font-semibold');
        infoDiv.innerHTML = '';
        if (nameElement) infoDiv.appendChild(nameElement.cloneNode(true));
        infoDiv.appendChild(settingsText);
        infoDiv.appendChild(participantsText);
      }
    }
  };


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
      localConfirmation?.classList.remove('hidden');
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

  if (backFromLocalConfirm) {
    backFromLocalConfirm.addEventListener('click', () => {
      localConfirmation?.classList.add('hidden');
      localOptions?.classList.remove('hidden');
    });
  }

  if (confirmLocalGame) {
    confirmLocalGame.addEventListener('click', () => {
      handleStartGame(user, 'local', '2player');
    });
  }

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
        handleStartGame(user, 'local', 'tournament');
      else
        handleStartGame(user, 'online', 'tournament');
    });
  }

  if (backFromJoin) {
    backFromJoin.addEventListener('click', () => {
      joinTournamentSection?.classList.add('hidden');
      onlineOptions?.classList.remove('hidden');
    });
  }

  document.querySelectorAll('.join-tournament-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tournamentId = btn.getAttribute('data-id');
        if (tournamentId) {
        try {
          const tournamentElement = document.querySelector(`li[data-id="${tournamentId}"]`);
          const isCreator = tournamentElement && tournamentElement.querySelector('.delete-tournament-btn');
          
          if (isCreator) {
            (window as any).navigate(`/tournament/${tournamentId}`);
          } else {
            await joinTournament(tournamentId);
            (window as any).navigate(`/tournament/${tournamentId}`);
          }
        } catch (error) {
          alert(error instanceof Error ? error.message : 'Failed to join tournament');
        }
      }
    });
  });

  document.querySelectorAll('.delete-tournament-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const tournamentId = btn.getAttribute('data-id');
      if (tournamentId) {
        if (!confirm('Are you sure you want to delete this tournament? All participants will be removed.')) {
          return;
        }
        
        try {
          await deleteTournament(tournamentId);
          
          const tournamentElement = document.querySelector(`li[data-id="${tournamentId}"]`);
          if (tournamentElement) {
            tournamentElement.remove();
          }
          
          const tournamentsList = document.querySelector('#open-tournaments-list ul');
          if (tournamentsList && tournamentsList.children.length === 0) {
            const container = document.getElementById('open-tournaments-list');
            if (container) {
              container.innerHTML = '<p class="text-gray-400 text-center py-4">No open tournaments available</p>';
            }
          }
          
        } catch (error) {
          console.error('Error deleting tournament:', error);
          alert(error instanceof Error ? error.message : 'Failed to delete tournament');
        }
      }
    });
  });

  if (playerAliasesContainer) {
    playerAliasesContainer.classList.add('hidden');
  }

  const optionsObserver = setupNavigationDetection();

  (window as any).cancelMatchmaking = cancelMatchmaking;
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
        <input id="alias-${i}" class="glass-input w-full p-2 bg-gray-700 rounded" placeholder="Player ${i + 1} name" value="Player ${i + 1}">
      </div>
    `).join('')}
  `;
}

async function handleStartGame(user: any, gameMode: string, gameType: string): Promise<void> {
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
      // alert('Joined matchmaking queue. Waiting for opponent...');
    }
  } catch (error) {
    console.error('Failed to start game:', error);
    alert(error instanceof Error ? error.message : 'Failed to start game');
  }
}
