import type { ClientMessage, JoinSession, ServerMessage } from '../types/protocol';
import { PROTOCOL_VERSION } from '../types/protocol';

export interface SignalingOptions {
  wsUrl: string;
  authBaseUrl: string;
  clientId: string;
  onMessage: (message: ServerMessage) => void;
  onStatus: (status: string) => void;
}

export class SignalingClient {
  private ws?: WebSocket;
  private reconnectTimer?: number;
  private pingTimer?: number;
  private reconnectAttempts = 0;
  private token?: string;
  private username = '';
  private session?: JoinSession;

  constructor(private readonly options: SignalingOptions) {}

  async connect(username: string, session?: JoinSession): Promise<void> {
    this.username = username;
    this.session = session;

    const authResponse = await fetch(`${this.options.authBaseUrl}/auth/dev`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });

    if (!authResponse.ok) {
      throw new Error(`Failed to auth user (${authResponse.status})`);
    }

    const authJson = (await authResponse.json()) as { token: string };
    this.token = authJson.token;
    this.openSocket();
  }

  send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  joinRoom(roomId: string, displayName: string): void {
    this.session = { roomId, displayName };
    this.send({ type: 'join_room', roomId, displayName });
  }

  leaveRoom(roomId: string): void {
    this.send({ type: 'leave_room', roomId });
    if (this.session?.roomId === roomId) {
      this.session = undefined;
    }
  }

  disconnect(): void {
    this.clearTimers();
    this.ws?.close();
  }

  private openSocket(): void {
    this.options.onStatus('connecting');
    const ws = new WebSocket(this.options.wsUrl);
    this.ws = ws;

    ws.addEventListener('open', () => {
      this.options.onStatus('connected');
      this.reconnectAttempts = 0;
      this.send({
        type: 'client_hello',
        protocolVersion: PROTOCOL_VERSION,
        clientId: this.options.clientId,
        authToken: this.token
      });

      if (this.session) {
        this.joinRoom(this.session.roomId, this.session.displayName);
      }

      this.pingTimer = window.setInterval(() => {
        this.send({ type: 'ping' });
      }, 10_000);
    });

    ws.addEventListener('message', (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as ServerMessage;
        this.options.onMessage(parsed);
      } catch {
        this.options.onStatus('invalid-message');
      }
    });

    ws.addEventListener('close', () => {
      this.options.onStatus('disconnected');
      this.scheduleReconnect();
    });

    ws.addEventListener('error', () => {
      this.options.onStatus('error');
    });
  }

  private scheduleReconnect(): void {
    this.clearPing();
    const backoffMs = Math.min(20_000, 1_000 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;

    this.reconnectTimer = window.setTimeout(() => {
      this.openSocket();
    }, backoffMs);
  }

  private clearPing(): void {
    if (this.pingTimer) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
  }

  private clearTimers(): void {
    this.clearPing();
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }
}
