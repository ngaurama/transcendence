import { createWebSocketHandler } from './websocket';
import { InputHandler } from './input';
import { initCanvas, updateScene, cleanupRenderer, gameState } from './renderer';
import { setupRematchHandler, setupPlayAgainHandler, setupTournamentHandlers } from './gameHandlers';
import { getGameInfo } from '../../../services';

export async function pongGamePage(): Promise<string> {
  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get('game_id');
  const tournamentId = urlParams.get('tournament_id');

  const gameInfo = await getGameInfo(gameId || '');
  (window as any).gameOptions = gameInfo.settings;
  return `
    <div class="max-w-4xl mx-auto px-2">
      <h2 class="text-2xl mb-4 text-center">${tournamentId ? `Tournament #${tournamentId} Match` : `Pong Game #${gameId}`}</h2>
      <div id="player-info" class="text-center mb-2">
        <p>${gameInfo.settings.gameMode === 'local' ? 
          "Player 1: Use W/S keys | Player 2: Use Arrow Up/Down keys" 
          : "Use Arrow Up/Down keys"}</p>
      </div>
      <div class="relative">
        <canvas id="game-canvas" class="game-canvas border border-gray-500 mx-auto block"></canvas>
        <div id="countdown-overlay" class="hidden absolute inset-0 flex items-center justify-center text-white text-6xl"></div>
      </div>
      <div id="player-names" class="mt-3 flex justify-between text-lg">
        <div id="player1-name" class="text-left"></div>
        <div id="player2-name" class="text-right"></div>
      </div>
      <div id="game-end" class="hidden text-center mt-4">
        <h3 id="winner-text" class="text-2xl mb-4"></h3>
        ${tournamentId 
          ? `<button id="view-bracket" class="glass-button bg-blue-500 text-white p-2 rounded mr-2">View Bracket</button>
             <button id="leave-tournament" class="glass-button bg-red-500 text-white p-2 rounded">Leave Tournament</button>`
          : `<button id="rematch" class="glass-button bg-blue-500 text-white p-2 rounded mr-2">Rematch</button>
             <button id="play-again" class="glass-button bg-green-500 text-white p-2 rounded">New Game</button>`
        }
      </div>
    </div>
  `;
}

export function attachPongGameListeners(): () => void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (canvas) initCanvas(canvas);

  const urlParams = new URLSearchParams(window.location.search);
  const tournamentId = urlParams.get('tournament_id');
  const gameId = urlParams.get('game_id');
  const token = localStorage.getItem('access_token');

  if (tournamentId) {
    setupTournamentHandlers(tournamentId);
  } else {
    setupRematchHandler();
    setupPlayAgainHandler();
  }

  // console.log('Starting game with ID:', gameId);
  // console.log('User token available:', !!token);

  if (!gameId) {
    console.error('No game ID found in URL');
    return () => {};
  }

  const onGameEnd = (winner: string) => {
    // console.log('Game ended, winner:', winner);
    const gameEndEl = document.getElementById('game-end');
    const winnerTextEl = document.getElementById('winner-text');
    
    if (gameEndEl) gameEndEl.classList.remove('hidden');
    if (winnerTextEl) {
      const winnerName = winner === 'player1' 
        ? (gameState.player_names?.player1 ?? 'Player 1')
        : (gameState.player_names?.player2 ?? 'Player 2');
      winnerTextEl.textContent = `Winner: ${winnerName}`;
    }
  };


  let ws: ReturnType<typeof createWebSocketHandler>;
  let inputHandler: InputHandler;

  const cleanup = () => {
    console.log('Cleaning up Pong game...');
    inputHandler.cleanup();
    if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    cleanupRenderer();
    sessionStorage.removeItem('pong_connected');
  };

  console.log('Attempting WebSocket connection...');
  ws = createWebSocketHandler(gameId, token, (window as any).gameOptions, onGameEnd, cleanup);
  inputHandler = new InputHandler(ws, (window as any).gameOptions?.gameMode === 'local');

  return cleanup;
}
