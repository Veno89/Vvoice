import {
    ClientMessage,
    ServerMessage,
    ClientHello,
    JoinRoom,
    ClientWebRTCOffer,
    ClientWebRTCAnswer,
    ClientWebRTCIceCandidate,
} from './protocol';

export class SignalingClient {
    private ws: WebSocket | null = null;
    private url: string;
    private protocolVersion = '1.0.0';
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private initialReconnectDelay = 1000;
    private maxReconnectDelay = 30000;
    private forcedClose = false;
    private reconnectTimer: number | null = null;

    private authToken: string;

    private heartbeatTimer: number | null = null;

    // Callbacks
    public onOpen?: () => void;
    public onClose?: () => void;
    public onError?: (err: Event) => void;
    public onMessage?: (msg: ServerMessage) => void;

    constructor(url: string, authToken: string) {
        this.url = url;
        this.authToken = authToken;
    }

    public get isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    public connect() {
        this.forcedClose = false;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

        console.log(`[Signaling] Connecting to ${this.url}`);
        this.ws = new WebSocket(this.url);
        this.ws.onopen = () => {
            console.log('[Signaling] Connected');
            this.reconnectAttempts = 0;
            this.sendHello();
            this.startHeartbeat();
            this.onOpen?.();
        };

        this.ws.onclose = () => {
            console.log('[Signaling] Disconnected');
            this.stopHeartbeat();
            this.onClose?.();
            if (!this.forcedClose) {
                this.scheduleReconnect();
            }
        };

        this.ws.onerror = (err) => {
            console.error('[Signaling] Error', err);
            this.onError?.(err);
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data) as ServerMessage;
                this.onMessage?.(msg);
            } catch (e) {
                console.error('[Signaling] Failed to parse message', event.data);
            }
        };
    }

    public disconnect() {
        this.forcedClose = true;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.stopHeartbeat();
        this.ws?.close();
    }

    private startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = window.setInterval(() => {
            this.send({ type: 'ping' });
        }, 10000);
    }

    private stopHeartbeat() {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    }

    private scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[Signaling] Max reconnect attempts reached');
            return;
        }

        const delay = Math.min(
            this.initialReconnectDelay * Math.pow(2, this.reconnectAttempts),
            this.maxReconnectDelay
        );

        console.log(`[Signaling] Reconnecting in ${delay}ms...`);
        this.reconnectTimer = window.setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
        }, delay);
    }

    public send(msg: ClientMessage) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        } else {
            console.warn('[Signaling] Cannot send, socket not open');
        }
    }

    private sendHello() {
        const hello: ClientHello = {
            type: 'client_hello',
            protocolVersion: this.protocolVersion,
            authToken: this.authToken
        };
        this.send(hello);
    }

    public joinRoom(roomId: string, displayName: string) {
        const msg: JoinRoom = {
            type: 'join_room',
            roomId,
            displayName
        };
        this.send(msg);
    }

    public sendOffer(toPeerId: string, sdp: RTCSessionDescriptionInit) {
        const msg: ClientWebRTCOffer = {
            type: 'webrtc_offer',
            toPeerId,
            sdp: JSON.stringify(sdp)
        };
        this.send(msg);
    }

    public sendAnswer(toPeerId: string, sdp: RTCSessionDescriptionInit) {
        const msg: ClientWebRTCAnswer = {
            type: 'webrtc_answer',
            toPeerId,
            sdp: JSON.stringify(sdp)
        };
        this.send(msg);
    }

    public sendCandidate(toPeerId: string, candidate: RTCIceCandidateInit) {
        const msg: ClientWebRTCIceCandidate = {
            type: 'webrtc_ice_candidate',
            toPeerId,
            candidate: JSON.stringify(candidate)
        };
        this.send(msg);
    }

    public setMute(roomId: string, muted: boolean) {
        if (!this.isConnected) return;
        this.send({
            type: 'set_mute',
            roomId,
            muted
        });
    }

    public sendChatMessage(roomId: string, content: string) {
        if (!this.isConnected) return;
        this.send({
            type: 'chat_message',
            roomId,
            content
        });
    }

    public createChannel(name: string, description?: string) {
        if (!this.isConnected) return;
        this.send({
            type: 'create_channel',
            name,
            description
        });
    }

    public deleteChannel(channelId: string) {
        if (!this.isConnected) return;
        this.send({
            type: 'delete_channel',
            channelId
        });
    }
}
