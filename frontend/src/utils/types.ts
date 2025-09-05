// types.ts
export interface User {
  is_guest: any;
  created_at: string | number | Date;
  id: number;
  username: string;
  email: string;
  display_name: string;
  avatar_url: string;
  is_verified: boolean;
  oauth_provider?: string;
  totp_enabled?: boolean;
}

export interface GameOptions {
  players: any;
  gameMode: string;
  gameType: string;
  points_to_win: number;
  powerups_enabled: boolean;
  board_variant: string;
  player1_name: string;
  player2_name?: string;
  canvasWidth?: number;
  canvasHeight?: number;
  opponent_id?: string;
}

export interface TournamentOptions extends GameOptions {
  name: string;
  max_participants: number;
  tournament_type: string;
  num_players?: number;
  aliases?: string[];
}
