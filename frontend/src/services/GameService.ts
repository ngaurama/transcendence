export interface GameOptions {
  mode: string;
  points: number;
  powerups: boolean;
  variant: string;
  opponent_alias?: string;
  canvasWidth?: number;
  canvasHeight?: number;
}

export interface TournamentOptions extends GameOptions {
  name: string;
  max_participants: number;
  tournament_type: string;
}

export async function createLocalGame(options: GameOptions): Promise<string> {
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetch(`/api/pong/game/create`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ 
        is_private: true,
        max_players: 2,
        power_ups_enabled: options.powerups,
        map_variant: options.variant,
        points_to_win: options.points,
        opponent_alias: options.opponent_alias || 'Player 2',
        canvasWidth: options.canvasWidth || 800,
        canvasHeight: options.canvasHeight || 600
      })
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

export async function joinMatchmaking(options: GameOptions): Promise<string> {
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetch(`/api/game/matchmaking/join`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ 
        game_type: 'pong', 
        skill_range: 'any',
        points_to_win: options.points,
        power_ups_enabled: options.powerups,
        map_variant: options.variant
      })
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to join matchmaking');
    }

    const data = await res.json();
    return data.game_id || data.match_id;
  } catch (error) {
    throw error;
  }
}

export async function createTournament(options: TournamentOptions): Promise<string> {
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetch(`/api/game/tournament/create`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ 
        name: options.name,
        max_participants: options.max_participants,
        tournament_type: options.tournament_type,
        game_type: 'pong',
        points_to_win: options.points,
        power_ups_enabled: options.powerups,
        map_variant: options.variant
      })
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

export async function startGame(mode: string, options: GameOptions): Promise<string> {
  switch (mode) {
    case 'online':
      return joinMatchmaking(options);
    case 'local':
      return createLocalGame(options);
    case 'tournament':
      return createTournament({
        ...options,
        name: 'My Tournament',
        max_participants: 8,
        tournament_type: 'single_elimination'
      });
    default:
      throw new Error(`Unknown game mode: ${mode}`);
  }
}
