// services/PongService.ts
import { fetchWithErrorHandling } from '.';
import { GameOptions, TournamentOptions } from '../utils/types';

export async function createGame(options: GameOptions, opponent_id?: number): Promise<string> {
  try {
    const token = localStorage.getItem('access_token');
    const body: any = {
      gameMode: options.gameMode,
      gameType: '2player',
      player1_name: options.player1_name || 'Player 1',
      player2_name: options.player2_name || 'Player 2',
      powerups_enabled: options.powerups_enabled,
      points_to_win: options.points_to_win,
      board_variant: options.board_variant,
    };

    if (options.gameMode !== 'local' && opponent_id) {
      body.opponent_id = opponent_id;
    }
    const res = await fetchWithErrorHandling(`/api/pong/game/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to create local game');
    }

    const data = await res.json();
    return data.game_id;
  } catch (error) {
    throw error;
  }
}

export async function joinMatchmaking(options: GameOptions): Promise<void> {
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetchWithErrorHandling(`/api/pong/matchmaking/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        powerups_enabled: options.powerups_enabled,
        points_to_win: options.points_to_win,
        board_variant: options.board_variant,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to join matchmaking');
    }
  } catch (error) {
    throw error;
  }
}

export async function createTournament(options: TournamentOptions): Promise<string> {
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetchWithErrorHandling(`/api/pong/tournament/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        tournament_settings: {
          name: options.name,
          max_participants: options.max_participants,
          gameMode: options.gameMode,
          gameType: options.gameType,
          powerups_enabled: options.powerups_enabled,
          points_to_win: options.points_to_win,
          board_variant: options.board_variant,
          num_players: options.num_players || options.max_participants,
          aliases: options.aliases || [],
        },
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to create tournament');
    }

    const data = await res.json();
    return data.tournament_id;
  } catch (error) {
    throw error;
  }
}

export async function joinTournament(tournamentId: string): Promise<void> {
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetchWithErrorHandling(`/api/pong/tournament/join/${tournamentId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to join tournament');
    }
  } catch (error) {
    throw error;
  }
}

export async function leaveTournament(tournamentId: string): Promise<void> {
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetchWithErrorHandling(`/api/pong/tournament/${tournamentId}/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to leave tournament');
    }
  } catch (error) {
    throw error;
  }
}

export async function startTournament(tournamentId: string): Promise<void> {
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetchWithErrorHandling(`/api/pong/tournament/start/${tournamentId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to start tournament');
    }
  } catch (error) {
    throw error;
  }
}

export async function deleteTournament(tournamentId: string): Promise<void> {
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetchWithErrorHandling(`/api/pong/tournament/${tournamentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to delete tournament');
    }
    return;
  } catch (error) {
    console.error('Error deleting tournament:', error);
    throw error;
  }
}

export async function startTournamentMatch(tournamentId: string, matchId: string): Promise<string> {
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetchWithErrorHandling(`/api/pong/tournament/match/start/${matchId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to start tournament match');
    }

    const data = await res.json();
    return data.game_id;
  } catch (error) {
    throw error;
  }
}

export async function getOpenTournaments(): Promise<any[]> {
  try {
    const res = await fetchWithErrorHandling(`/api/pong/tournaments/open`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to fetchWithErrorHandling open tournaments');
    }

    return await res.json();
  } catch (error) {
    throw error;
  }
}

export async function getUserStats(userId?: number): Promise<any> {
  try {
    const token = localStorage.getItem('access_token');
    const url = userId 
      ? `/api/social/stats/${userId}`
      : `/api/social/stats`;
    
    const res = await fetchWithErrorHandling(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error('Failed to fetchWithErrorHandling user stats');
    }

    return await res.json();
  } catch (error) {
    throw error;
  }
}

export async function getGameInfo(gameId: string): Promise<any> {
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetchWithErrorHandling(`/api/pong/game/${gameId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error('Failed to get game info');
    }

    return await res.json();
  } catch (error) {
    throw error;
  }
}

export async function requestMatch(options: GameOptions, opponentId?: number): Promise<string> {
  if (options) {
    try {
      let gameId: string;
      if (options.gameMode === 'local') {
        gameId = await createGame(options);
      } else {
        if (!opponentId) {
          throw new Error('Opponent ID required for online rematch');
        }
        gameId = await createGame(options, opponentId);
      }
      // console.log(`Rematch created: game_id=${gameId}`);
      return gameId;
    } catch (error) {
      console.error('Rematch failed:', error);
      throw error;
    }
  }
  throw new Error('No game options available for rematch');
}
