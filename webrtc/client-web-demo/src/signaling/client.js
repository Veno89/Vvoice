export class SignalingClient {
    ws = null;
    url;
    clientId;
    protocolVersion = '1.0.0';
    reconnectAttempts = 0;
    maxReconnectAttempts = 10;
    initialReconnectDelay = 1000;
    maxReconnectDelay = 30000;
    forcedClose = false;
    reconnectTimer = null;
    authToken;
    heartbeatTimer = null;
    // Callbacks
    onOpen;
    onClose;
    onError;
    onMessage;
    constructor(url, clientId, authToken) {
        this.url = url;
        this.clientId = clientId;
        this.authToken = authToken;
    }
    connect() {
        this.forcedClose = false;
        if (this.reconnectTimer)
            clearTimeout(this.reconnectTimer);
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
                const msg = JSON.parse(event.data);
                this.onMessage?.(msg);
            }
            catch (e) {
                console.error('[Signaling] Failed to parse message', event.data);
            }
        };
    }
    disconnect() {
        this.forcedClose = true;
        if (this.reconnectTimer)
            clearTimeout(this.reconnectTimer);
        this.stopHeartbeat();
        this.ws?.close();
    }
    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = window.setInterval(() => {
            this.send({ type: 'ping' });
        }, 10000);
    }
    stopHeartbeat() {
        if (this.heartbeatTimer)
            clearInterval(this.heartbeatTimer);
    }
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[Signaling] Max reconnect attempts reached');
            return;
        }
        const delay = Math.min(this.initialReconnectDelay * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
        console.log(`[Signaling] Reconnecting in ${delay}ms...`);
        this.reconnectTimer = window.setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
        }, delay);
    }
    send(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
        else {
            console.warn('[Signaling] Cannot send, socket not open');
        }
    }
    sendHello() {
        const hello = {
            type: 'client_hello',
            protocolVersion: this.protocolVersion,
            authToken: this.authToken
        };
        this.send(hello);
    }
    joinRoom(roomId, displayName) {
        const msg = {
            type: 'join_room',
            roomId,
            displayName
        };
        this.send(msg);
    }
    sendOffer(toPeerId, sdp) {
        const msg = {
            type: 'webrtc_offer',
            toPeerId,
            sdp: JSON.stringify(sdp)
        };
        this.send(msg);
    }
    sendAnswer(toPeerId, sdp) {
        const msg = {
            type: 'webrtc_answer',
            toPeerId,
            sdp: JSON.stringify(sdp)
        };
        this.send(msg);
    }
    sendCandidate(toPeerId, candidate) {
        const msg = {
            type: 'webrtc_ice_candidate',
            toPeerId,
            candidate: JSON.stringify(candidate)
        };
        this.send(msg);
    }
    setMute(roomId, muted) {
        const msg = {
            type: 'set_mute',
            roomId,
            muted
        };
        this.send(msg);
    }
}
