import { PROTOCOL_VERSION } from '../types/protocol';
export class SignalingClient {
    options;
    ws;
    reconnectTimer;
    pingTimer;
    reconnectAttempts = 0;
    token;
    username = '';
    session;
    constructor(options) {
        this.options = options;
    }
    async connect(username, session) {
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
        const authJson = (await authResponse.json());
        this.token = authJson.token;
        this.openSocket();
    }
    send(message) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }
    joinRoom(roomId, displayName) {
        this.session = { roomId, displayName };
        this.send({ type: 'join_room', roomId, displayName });
    }
    leaveRoom(roomId) {
        this.send({ type: 'leave_room', roomId });
        if (this.session?.roomId === roomId) {
            this.session = undefined;
        }
    }
    disconnect() {
        this.clearTimers();
        this.ws?.close();
    }
    openSocket() {
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
                const parsed = JSON.parse(String(event.data));
                this.options.onMessage(parsed);
            }
            catch {
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
    scheduleReconnect() {
        this.clearPing();
        const backoffMs = Math.min(20_000, 1_000 * 2 ** this.reconnectAttempts);
        this.reconnectAttempts += 1;
        this.reconnectTimer = window.setTimeout(() => {
            this.openSocket();
        }, backoffMs);
    }
    clearPing() {
        if (this.pingTimer) {
            window.clearInterval(this.pingTimer);
            this.pingTimer = undefined;
        }
    }
    clearTimers() {
        this.clearPing();
        if (this.reconnectTimer) {
            window.clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
    }
}
