import { GameOptions } from './GameService';

const STORAGE_KEY = 'gameOptions';

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

export function clearGameOptions(): void {
  localStorage.removeItem(STORAGE_KEY);
}