// services/GameOptionsService.ts - Enhanced version
import { GameOptions, TournamentOptions } from '../utils/types';

const STORAGE_KEY = 'gameOptions';
const TOURNAMENT_STORAGE_KEY = 'tournamentOptions';

export function saveGameOptions(options: Partial<GameOptions>): void {
  const existingOptions = getGameOptions();
  const mergedOptions = { ...existingOptions, ...options };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedOptions));
}

export function getGameOptions(): Partial<GameOptions> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function saveTournamentOptions(options: TournamentOptions): void {
  localStorage.setItem(TOURNAMENT_STORAGE_KEY, JSON.stringify(options));
}

export function getTournamentOptions(): TournamentOptions | null {
  try {
    const stored = localStorage.getItem(TOURNAMENT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function clearGameOptions(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TOURNAMENT_STORAGE_KEY);
}
