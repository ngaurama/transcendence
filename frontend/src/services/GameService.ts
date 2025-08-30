// services/GameService.ts
import { GameOptions, TournamentOptions } from '../utils/types';
import { createLocalGame, joinMatchmaking, createTournament } from './PongService';

export async function startGame(options: GameOptions | TournamentOptions): Promise<string> {
  switch (options.gameMode) {
    case 'online':
      if (options.gameType === '2player') {
        await joinMatchmaking(options as GameOptions);
        return '';
      }
      else
        return createTournament(options as TournamentOptions);


    case 'local':
      if (options.gameType === '2player')
        return createLocalGame(options as GameOptions);
      else {
        return createTournament(options as TournamentOptions);
      }

  
    default:
      throw new Error(`Unknown game mode: ${options.gameMode}`);
  }
}
