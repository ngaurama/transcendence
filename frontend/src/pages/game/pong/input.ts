// pages/input.ts - Updated version
import { sendPaddleMove } from './websocket';
import { checkAuthStatus } from '../../../services';

export class InputHandler {
  private playerNumber: number | null = null;
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

    this.ws.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'auth_success' && data.player_number) {
          this.playerNumber = data.player_number;
          console.log(`Authenticated as Player ${this.playerNumber}`);
        }
      } catch (error) {

      }
    });
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
          sendPaddleMove(this.ws, { 
            direction: 'up' ,
            player_number: this.playerNumber
          });
        } else if (this.keyState['s']) {
          sendPaddleMove(this.ws, { 
            direction: 'down',
            player_number: this.playerNumber
          });
        } else {
          sendPaddleMove(this.ws, { 
            direction: 'stop',
            player_number: this.playerNumber
          });
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
