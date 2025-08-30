// utils/playerNames.ts
export interface PlayerNames {
  player1: string;
  player2: string;
  player1_id?: number;
  player2_id?: number;
}

export function getPlayerNames(options: any, user: any): PlayerNames {
  if (options.gameMode === 'local' && options.tournament_id) {
    // Local tournament - use provided aliases
    return {
      player1: options.player1_name || 'Player 1',
      player2: options.player2_name || 'Player 2'
    };
  } else if (options.gameMode === 'local') {
    // Local 2-player game
    return {
      player1: options.player1_name || 'Player 1',
      player2: options.player2_name || 'Player 2'
    };
  } else {
    // Online game - will be set via WebSocket
    return {
      player1: 'Player 1',
      player2: 'Player 2'
    };
  }
}
