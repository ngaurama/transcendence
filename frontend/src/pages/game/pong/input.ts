// pages/input.ts - Updated version
import { sendPaddleMove } from './websocket';
import { checkAuthStatus } from '../../../services';

export class InputHandler {
  private playerInput: string | null = null;
  private ws: WebSocket;
  private isLocal: boolean;
  private userId: number | null = null;
  private keyState: { [key: string]: boolean } = {};

  constructor(webSocket: WebSocket, isLocal: boolean) {
    this.ws = webSocket;
    this.isLocal = isLocal;
    this.setupUserId();
    this.setupEventListeners();
    this.startInputLoop();
  }
  
  private async setupUserId() {
    const user = await checkAuthStatus();
    this.userId = user?.id || null;
  }

  private setupEventListeners(): void {
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    this.keyState[event.key.toLowerCase()] = true;
  }

  private handleKeyUp(event: KeyboardEvent): void {
    this.keyState[event.key.toLowerCase()] = false;
  }

  private startInputLoop(): void {
    const processInput = () => {
      if (this.isLocal) {
        if (this.keyState['w']) {
          sendPaddleMove(this.ws, { player1_direction: 'up' });
        } else if (this.keyState['s']) {
          sendPaddleMove(this.ws, { player1_direction: 'down' });
        } else {
          sendPaddleMove(this.ws, { player1_direction: 'stop' });
        }

        if (this.keyState['arrowup']) {
          sendPaddleMove(this.ws, { player2_direction: 'up' });
        } else if (this.keyState['arrowdown']) {
          sendPaddleMove(this.ws, { player2_direction: 'down' });
        } else {
          sendPaddleMove(this.ws, { player2_direction: 'stop' });
        }
      } else {
        if (this.keyState['w']) {
          sendPaddleMove(this.ws, { direction: 'up' });
        } else if (this.keyState['s']) {
          sendPaddleMove(this.ws, { direction: 'down' });
        } else {
          sendPaddleMove(this.ws, { direction: 'stop' });
        }
      }
      
      requestAnimationFrame(processInput);
    };
    
    requestAnimationFrame(processInput);
  }

  public cleanup(): void {
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    document.removeEventListener('keyup', this.handleKeyUp.bind(this));
  }
}
