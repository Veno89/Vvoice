import type { WebSocket } from 'ws';
import type { ServerMessage } from '../types/protocol.js';
import type { RoomManager } from '../domain/room-manager.js';
import { log } from '../utils/log.js';

/** Map of connectionId → { ws } for looking up sockets. */
export type ConnectionMap = Map<string, { ws: WebSocket }>;

export function send(ws: WebSocket, message: ServerMessage): void {
    const safe = sanitizeForLogs(message);
    log.debug({ msg: safe }, 'ws_send');
    ws.send(JSON.stringify(message));
}

export function sendError(ws: WebSocket, code: string, message: string): void {
    send(ws, { type: 'signal_error', code, message });
}

export function broadcastRoom(
    roomMgr: RoomManager,
    connections: ConnectionMap,
    roomId: string,
    message: ServerMessage,
    excludePeerId?: string
): void {
    const participants = roomMgr.getRoomParticipants(roomId);
    for (const participant of participants) {
        if (excludePeerId && participant.peerId === excludePeerId) continue;
        const connection = connections.get(participant.connectionId);
        if (connection) {
            send(connection.ws, message);
        }
    }
}

export function broadcastAll(connections: ConnectionMap, message: ServerMessage): void {
    for (const connection of connections.values()) {
        send(connection.ws, message);
    }
}

function sanitizeForLogs(message: ServerMessage): Record<string, unknown> {
    if (message.type === 'webrtc_offer' || message.type === 'webrtc_answer') {
        return { ...message, sdp: '[redacted]' };
    }
    if (message.type === 'webrtc_ice_candidate') {
        return { ...message, candidate: '[redacted]' };
    }
    return message;
}
