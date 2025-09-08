import { requestMatch, getGameInfo } from '../../../services/PongService';
import { checkAuthStatus } from '../../../services';

export function setupRematchHandler() {
  const rematchBtn = document.getElementById('rematch');
  if (!rematchBtn) return;

  rematchBtn.addEventListener('click', async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const gameId = urlParams.get('game_id');
      const token = localStorage.getItem('access_token');
      
      if (!token || !gameId) {
        throw new Error('Missing token or game ID');
      }

      const gameInfo = await getGameInfo(gameId);      
      const options = {
        ...gameInfo.settings,
        players: gameInfo.players
      };
      // const options = gameInfo.settings;

      if (options.gameMode === 'local') {
        const newGameId = await requestMatch(options);

        // console.log("Local rematch created, navigating to:", newGameId);
        
        (window as any).navigate(`/game/pong?game_id=${newGameId}`);
      } else {
        const currentUser = await checkAuthStatus();
        const opponent = gameInfo.players.find((p: any) => p.id !== currentUser?.id);
        
        if (opponent) {
          const newGameId = await requestMatch(options, opponent.id);
          rematchBtn.style.display = 'none';
          rematchBtn.textContent = 'Waiting for opponent...';

          (window as any).pendingRematchGameId = { 
            newGameId,
            originaltext: 'Rematch'
          };
        } else {
          throw new Error('Could not find opponent');
        }
      }
    } catch (error) {
      console.error('Rematch failed:', error);
      alert('Failed to request rematch');
    }
  });
}

export function setupPlayAgainHandler(): void {
  const playAgainBtn = document.getElementById("play-again");
  if (playAgainBtn) {
    playAgainBtn.addEventListener("click", () => {
      (window as any).navigate("/play");
    });
  }
}

export function setupTournamentHandlers(tournamentId: string): void {
  const viewBracketBtn = document.getElementById("view-bracket");
  const leaveTournamentBtn = document.getElementById("leave-tournament");

  if (viewBracketBtn) {
    viewBracketBtn.addEventListener("click", () => {
      (window as any).navigate(`/tournament/${tournamentId}`);
    });
  }

  if (leaveTournamentBtn) {
    leaveTournamentBtn.addEventListener("click", () => {
      (window as any).navigate("/");
    });
  }
}

