import { log } from '../utils/log.js';
export function send(ws, message) {
    const safe = sanitizeForLogs(message);
    log.debug({ msg: safe }, 'ws_send');
    ws.send(JSON.stringify(message));
}
export function sendError(ws, code, message) {
    send(ws, { type: 'signal_error', code, message });
}
export function broadcastRoom(roomMgr, connections, roomId, message, excludePeerId) {
    const participants = roomMgr.getRoomParticipants(roomId);
    for (const participant of participants) {
        if (excludePeerId && participant.peerId === excludePeerId)
            continue;
        const connection = connections.get(participant.connectionId);
        if (connection) {
            send(connection.ws, message);
        }
    }
}
export function broadcastAll(connections, message) {
    for (const connection of connections.values()) {
        send(connection.ws, message);
    }
}
function sanitizeForLogs(message) {
    if (message.type === 'webrtc_offer' || message.type === 'webrtc_answer') {
        return { ...message, sdp: '[redacted]' };
    }
    if (message.type === 'webrtc_ice_candidate') {
        return { ...message, candidate: '[redacted]' };
    }
    return message;
}
