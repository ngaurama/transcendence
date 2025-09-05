// services/StatsService.ts - New service for enhanced stats
import { fetchWithErrorHandling } from '.';
import { GameOptions } from '../utils/types';

export interface GameHistoryItem {
  id: number;
  date: Date;
  opponent: string;
  result: 'win' | 'loss';
  score: string;
  duration: number;
  options: GameOptions;
  tournament_id?: number;
}

export async function getGameHistory(): Promise<GameHistoryItem[]> {
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetchWithErrorHandling(`/api/pong/game-history`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error('Failed to fetch game history');
    }

    return await res.json();
  } catch (error) {
    console.error('Error fetching game history:', error);
    return [];
  }
}
