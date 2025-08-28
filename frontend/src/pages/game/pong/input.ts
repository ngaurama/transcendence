import { sendPaddleMove } from './websocket';

export class InputHandler {
  private player1Input: string | null = null;
  private player2Input: string | null = null;
  private ws: WebSocket;

  constructor(webSocket: WebSocket) {
    this.ws = webSocket;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    document.addEventListener("keydown", this.handleKeyDown.bind(this));
    document.addEventListener("keyup", this.handleKeyUp.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "w" || event.key === "W") {
      this.player1Input = "up";
    } else if (event.key === "s" || event.key === "S") {
      this.player1Input = "down";
    }

    if (event.key === "ArrowUp") {
      this.player2Input = "up";
    } else if (event.key === "ArrowDown") {
      this.player2Input = "down";
    }

    sendPaddleMove(this.ws, this.player1Input, this.player2Input);
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (event.key === "w" || event.key === "s" || event.key === "W" || event.key === "S") {
      this.player1Input = "stop";
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      this.player2Input = "stop";
    }

    sendPaddleMove(this.ws, this.player1Input, this.player2Input);
  }

  public cleanup(): void {
    document.removeEventListener("keydown", this.handleKeyDown.bind(this));
    document.removeEventListener("keyup", this.handleKeyUp.bind(this));
  }
}
