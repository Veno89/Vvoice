import { verifyToken } from '../security/auth.js';
import { generateTurnCredentials } from '../security/turn-credentials.js';
import * as userRepo from '../db/user-repo.js';
import { protocolVersion } from '../types/protocol.js';
import * as messageRepo from '../db/message-repo.js';
import { send, sendError, broadcastRoom, broadcastAll } from './broadcast.js';
/**
 * Handle a validated client message.
 */
export function handleClientMessage(msg, state, cfg, roomManager, channelManager, connections, byPeerId) {
    const { ws, connectionId } = state;
    if (!state.authenticated && msg.type !== 'client_hello') {
        sendError(ws, 'unauthorized', 'Send client_hello first');
        return;
    }
    try {
        switch (msg.type) {
            case 'client_hello': {
                if (msg.protocolVersion !== protocolVersion) {
                    sendError(ws, 'protocol_mismatch', `Expected protocol ${protocolVersion}`);
                    return;
                }
                const claims = verifyToken(cfg.jwtSecret, msg.authToken);
                state.userId = claims.sub;
                state.displayName = claims.name;
                state.role = claims.role;
                // Fetch profile
                const user = userRepo.findById(claims.sub);
                if (user) {
                    state.avatarUrl = user.avatar_url ?? undefined; // Convert null to undefined
                    state.bio = user.bio;
                }
                state.authenticated = true;
                send(ws, { type: 'server_notice', message: `Authenticated as ${state.displayName}` });
                // Send current channel list on connect
                send(ws, { type: 'channel_list', channels: channelManager.listChannels() });
                break;
            }
            case 'join_room': {
                const joined = roomManager.joinRoom(connectionId, state.userId, msg.displayName, msg.roomId, {
                    avatarUrl: state.avatarUrl,
                    bio: state.bio,
                    role: state.role
                });
                state.peerIds.add(joined.self.peerId);
                byPeerId.set(joined.self.peerId, state);
                send(ws, {
                    type: 'room_joined',
                    roomId: msg.roomId,
                    selfPeerId: joined.self.peerId,
                    participants: joined.participants,
                    iceServers: generateTurnCredentials(cfg, state.userId)
                });
                broadcastRoom(roomManager, connections, msg.roomId, {
                    type: 'participant_joined',
                    roomId: msg.roomId,
                    peerId: joined.self.peerId,
                    displayName: joined.self.displayName,
                    muted: joined.self.muted,
                    avatarUrl: joined.self.avatarUrl,
                    bio: joined.self.bio,
                    role: joined.self.role
                }, joined.self.peerId);
                // Send chat history
                const history = messageRepo.getRecentMessages(msg.roomId);
                for (const m of history) {
                    send(ws, {
                        type: 'chat_message',
                        roomId: msg.roomId,
                        senderId: m.user_id, // Use userId as senderId for history
                        displayName: m.user_name,
                        content: m.content,
                        timestamp: m.created_at
                    });
                }
                break;
            }
            case 'leave_room': {
                const removed = roomManager.leaveRoom(connectionId, msg.roomId);
                for (const participant of removed) {
                    state.peerIds.delete(participant.peerId);
                    byPeerId.delete(participant.peerId);
                    broadcastRoom(roomManager, connections, msg.roomId, {
                        type: 'participant_left',
                        roomId: msg.roomId,
                        peerId: participant.peerId
                    });
                }
                break;
            }
            case 'set_mute': {
                const participant = roomManager.setMute(connectionId, msg.roomId, msg.muted);
                broadcastRoom(roomManager, connections, msg.roomId, {
                    type: 'participant_muted',
                    roomId: msg.roomId,
                    peerId: participant.peerId,
                    muted: participant.muted
                });
                break;
            }
            case 'chat_message': {
                const participants = roomManager.getRoomParticipants(msg.roomId);
                const isInRoom = participants.some(p => p.connectionId === connectionId);
                if (!isInRoom) {
                    sendError(ws, 'not_in_room', 'You must join the room to send messages');
                    return;
                }
                const senderPeerId = [...state.peerIds][0];
                const timestamp = Date.now();
                messageRepo.saveMessage(msg.roomId, senderPeerId || state.userId, state.displayName, msg.content);
                broadcastRoom(roomManager, connections, msg.roomId, {
                    type: 'chat_message',
                    roomId: msg.roomId,
                    senderId: senderPeerId || state.userId,
                    displayName: state.displayName,
                    content: msg.content,
                    timestamp
                });
                break;
            }
            case 'create_channel': {
                if (state.role !== 'admin') {
                    sendError(ws, 'permission_denied', 'Only admins can create channels');
                    return;
                }
                const channel = channelManager.createChannel(msg.name, msg.description ?? '');
                // Broadcast updated channel list to everyone
                broadcastAll(connections, { type: 'channel_list', channels: channelManager.listChannels() });
                break;
            }
            case 'delete_channel': {
                if (state.role !== 'admin') {
                    sendError(ws, 'permission_denied', 'Only admins can delete channels');
                    return;
                }
                const deleted = channelManager.deleteChannel(msg.channelId);
                if (!deleted) {
                    sendError(ws, 'cannot_delete_channel', 'Cannot delete this channel');
                    return;
                }
                broadcastAll(connections, { type: 'channel_list', channels: channelManager.listChannels() });
                break;
            }
            case 'webrtc_offer':
            case 'webrtc_answer':
            case 'webrtc_ice_candidate': {
                const target = byPeerId.get(msg.toPeerId);
                if (!target) {
                    sendError(ws, 'peer_not_found', 'Target peer is not connected');
                    return;
                }
                const senderPeerId = [...state.peerIds][0];
                if (!senderPeerId) {
                    sendError(ws, 'not_in_room', 'Join a room before signaling');
                    return;
                }
                if (msg.type === 'webrtc_offer') {
                    send(target.ws, { type: 'webrtc_offer', fromPeerId: senderPeerId, sdp: msg.sdp });
                }
                else if (msg.type === 'webrtc_answer') {
                    send(target.ws, { type: 'webrtc_answer', fromPeerId: senderPeerId, sdp: msg.sdp });
                }
                else {
                    send(target.ws, { type: 'webrtc_ice_candidate', fromPeerId: senderPeerId, candidate: msg.candidate });
                }
                break;
            }
            case 'ping': {
                send(ws, { type: 'pong', ts: Date.now() });
                break;
            }
            default:
                sendError(ws, 'unsupported_message', 'Unsupported message type');
        }
    }
    catch (error) {
        const code = mapErrorCode(error);
        sendError(ws, code, 'Request failed');
    }
}
const KNOWN_ERROR_CODES = new Set([
    'max_rooms_per_connection',
    'room_full',
    'room_not_found',
    'participant_not_found',
    'missing_token',
    'invalid_token',
    'protocol_mismatch',
    'permission_denied',
]);
function mapErrorCode(error) {
    if (error instanceof Error && KNOWN_ERROR_CODES.has(error.message)) {
        return error.message;
    }
    return 'internal_error';
}
