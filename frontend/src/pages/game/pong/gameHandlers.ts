import { requestRematch } from '../../../services/PongService';

export function setupRematchHandler(): void {
  const rematchBtn = document.getElementById("rematch");
  if (rematchBtn) {
    rematchBtn.addEventListener("click", handleRematch);
  }
}

export function setupPlayAgainHandler(): void {
  const playAgainBtn = document.getElementById("play-again");
  if (playAgainBtn) {
    playAgainBtn.addEventListener("click", () => {
      console.log("Navigating to play page");
      (window as any).navigate("/play");
    });
  }
}

async function handleRematch(): Promise<void> {
  try {
    const gameId = await requestRematch();
    (window as any).navigate(`/game/pong?game_id=${gameId}`);
  } catch (error) {
    console.error("Rematch failed:", error);
    alert(error instanceof Error ? error.message : "Failed to create rematch");
  }
}
