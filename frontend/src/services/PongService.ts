export interface GameOptions {
  mode: string;
  powerups: boolean;
  variant: string;
  points: number;
  opponent_alias: string;
  canvasWidth?: number;
  canvasHeight?: number;
}

export async function createLocalGame(options: GameOptions): Promise<string> {
  try {
    const token = localStorage.getItem("access_token");
    const res = await fetch(`/api/pong/game/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        is_private: true,
        max_players: 2,
        power_ups_enabled: options.powerups,
        map_variant: options.variant,
        points_to_win: options.points,
        opponent_alias: options.opponent_alias,
        canvasWidth: options.canvasWidth || 800,
        canvasHeight: options.canvasHeight || 600
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to create game");
    }

    const data = await res.json();
    if (data.success) {
      return data.game_id;
    } else {
      throw new Error(data.error || "Game creation failed");
    }
  } catch (error) {
    throw error;
  }
}

export async function requestRematch(): Promise<string> {
  const opt = (window as any).gameOptions as GameOptions;
  
  if (opt && opt.mode === "local") {
    try {
      const gameId = await createLocalGame(opt);
      console.log(`Rematch created: game_id=${gameId}`);
      return gameId;
    } catch (error) {
      console.error("Rematch failed:", error);
      throw error;
    }
  }
  
  throw new Error("No local game options available for rematch");
}
