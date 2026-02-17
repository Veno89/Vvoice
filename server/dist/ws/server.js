import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { SlidingWindowRateLimiter } from '../security/rate-limiter.js';
import { clientMessageSchema } from '../types/protocol.js';
import { log } from '../utils/log.js';
import { send, sendError, broadcastRoom } from './broadcast.js';
import { handleClientMessage } from './message-handler.js';
export function registerWebSocketServer(app, cfg, roomManager, channelManager, connections, byPeerId) {
    const wss = new WebSocketServer({ noServer: true });
    const msgRateLimiter = new SlidingWindowRateLimiter(cfg.wsMessageBurst, cfg.wsMessageWindowMs);
    const ipConnections = new Map();
    const MAX_CONNECTIONS_PER_IP = 5;
    app.server.on('upgrade', (request, socket, head) => {
        if (request.url !== '/ws') {
            socket.destroy();
            return;
        }
        const ip = request.headers['x-forwarded-for']?.split(',')[0]?.trim() || request.socket.remoteAddress || 'unknown';
        const currentCount = ipConnections.get(ip) ?? 0;
        if (currentCount >= MAX_CONNECTIONS_PER_IP) {
            log.warn({ ip, count: currentCount }, 'ws_ip_limit_exceeded');
            socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
            socket.destroy();
            return;
        }
        ipConnections.set(ip, currentCount + 1);
        wss.handleUpgrade(request, socket, head, (ws) => {
            ws.__ip = ip;
            wss.emit('connection', ws);
        });
    });
    wss.on('connection', (ws) => {
        const connectionId = randomUUID();
        const ip = ws.__ip ?? 'unknown';
        const state = {
            connectionId,
            userId: 'anonymous',
            displayName: 'Anonymous',
            role: 'member',
            ws,
            authenticated: false,
            peerIds: new Set()
        };
        connections.set(connectionId, state);
        send(ws, { type: 'server_notice', message: 'Connected. Send client_hello to authenticate.' });
        ws.on('message', (raw) => {
            if (!msgRateLimiter.consume(connectionId)) {
                sendError(ws, 'rate_limited', 'Too many messages');
                ws.close(1008, 'rate_limited');
                return;
            }
            let data;
            try {
                data = JSON.parse(raw.toString());
            }
            catch {
                sendError(ws, 'invalid_json', 'Invalid JSON payload');
                return;
            }
            const parsed = clientMessageSchema.safeParse(data);
            if (!parsed.success) {
                sendError(ws, 'invalid_message', 'Message does not conform to protocol');
                return;
            }
            handleClientMessage(parsed.data, state, cfg, roomManager, channelManager, connections, byPeerId);
        });
        ws.on('close', () => {
            const departures = roomManager.leaveAll(connectionId);
            for (const event of departures) {
                byPeerId.delete(event.participant.peerId);
                broadcastRoom(roomManager, connections, event.roomId, {
                    type: 'participant_left',
                    roomId: event.roomId,
                    peerId: event.participant.peerId
                });
            }
            connections.delete(connectionId);
            msgRateLimiter.clear(connectionId);
            // Decrement IP connection count
            const count = ipConnections.get(ip) ?? 1;
            if (count <= 1) {
                ipConnections.delete(ip);
            }
            else {
                ipConnections.set(ip, count - 1);
            }
        });
    });
}
