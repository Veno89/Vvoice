import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ServerConfig } from '../config.js';
import { RoomManager } from '../domain/room-manager.js';
import { verifyToken } from '../security/auth.js';
import { SlidingWindowRateLimiter } from '../security/rate-limiter.js';
import { clientMessageSchema, protocolVersion, type ServerMessage } from '../types/protocol.js';
import { log } from '../utils/log.js';

interface ConnectionState {
  connectionId: string;
  userId: string;
  displayName: string;
  ws: WebSocket;
  authenticated: boolean;
  peerIds: Set<string>;
}

export function registerWebSocketServer(app: FastifyInstance, cfg: ServerConfig): void {
  const roomManager = new RoomManager(cfg.maxRoomParticipants, cfg.maxRoomsPerConnection);
  const wss = new WebSocketServer({ noServer: true });

  const connections = new Map<string, ConnectionState>();
  const byPeerId = new Map<string, ConnectionState>();
  const msgRateLimiter = new SlidingWindowRateLimiter(cfg.wsMessageBurst, cfg.wsMessageWindowMs);

  app.server.on('upgrade', (request: any, socket: any, head: any) => {
    if (request.url !== '/ws') {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws);
    });
  });

  wss.on('connection', (ws) => {
    const connectionId = randomUUID();
    const state: ConnectionState = {
      connectionId,
      userId: 'anonymous',
      displayName: 'Anonymous',
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

      const text = raw.toString();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        sendError(ws, 'invalid_json', 'Invalid JSON payload');
        return;
      }

      const parsed = clientMessageSchema.safeParse(data);
      if (!parsed.success) {
        sendError(ws, 'invalid_message', 'Message does not conform to protocol');
        return;
      }

      const msg = parsed.data;

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
            state.authenticated = true;
            send(ws, { type: 'server_notice', message: `Authenticated as ${state.displayName}` });
            break;
          }
          case 'join_room': {
            const joined = roomManager.joinRoom(connectionId, state.userId, msg.displayName, msg.roomId);
            state.peerIds.add(joined.self.peerId);
            byPeerId.set(joined.self.peerId, state);

            send(ws, {
              type: 'room_joined',
              roomId: msg.roomId,
              selfPeerId: joined.self.peerId,
              participants: joined.participants
            });

            broadcastRoom(roomManager, msg.roomId, {
              type: 'participant_joined',
              roomId: msg.roomId,
              peerId: joined.self.peerId,
              displayName: joined.self.displayName,
              muted: joined.self.muted
            }, joined.self.peerId);
            break;
          }
          case 'leave_room': {
            const removed = roomManager.leaveRoom(connectionId, msg.roomId);
            for (const participant of removed) {
              state.peerIds.delete(participant.peerId);
              byPeerId.delete(participant.peerId);
              broadcastRoom(roomManager, msg.roomId, {
                type: 'participant_left',
                roomId: msg.roomId,
                peerId: participant.peerId
              });
            }
            break;
          }
          case 'set_mute': {
            const participant = roomManager.setMute(connectionId, msg.roomId, msg.muted);
            broadcastRoom(roomManager, msg.roomId, {
              type: 'participant_muted',
              roomId: msg.roomId,
              peerId: participant.peerId,
              muted: participant.muted
            });
            break;
          }
          case 'chat_message': {
            // Verify user is in room
            const participants = roomManager.getRoomParticipants(msg.roomId);
            const isInRoom = participants.some(p => p.connectionId === connectionId);

            if (!isInRoom) {
              sendError(ws, 'not_in_room', 'You must join the room to send messages');
              return;
            }

            const senderPeerId = [...state.peerIds][0]; // Assuming 1 active peer per connection for now

            broadcastRoom(roomManager, msg.roomId, {
              type: 'chat_message',
              roomId: msg.roomId,
              senderId: senderPeerId || state.userId, // Use peerId if available, fallback to userId
              displayName: state.displayName,
              content: msg.content,
              timestamp: Date.now()
            });
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
            } else if (msg.type === 'webrtc_answer') {
              send(target.ws, { type: 'webrtc_answer', fromPeerId: senderPeerId, sdp: msg.sdp });
            } else {
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
      } catch (error) {
        const code = error instanceof Error ? error.message : 'internal_error';
        sendError(ws, code, 'Request failed');
      }
    });

    ws.on('close', () => {
      const departures = roomManager.leaveAll(connectionId);
      for (const event of departures) {
        byPeerId.delete(event.participant.peerId);
        broadcastRoom(roomManager, event.roomId, {
          type: 'participant_left',
          roomId: event.roomId,
          peerId: event.participant.peerId
        });
      }
      connections.delete(connectionId);
      msgRateLimiter.clear(connectionId);
    });
  });

  function broadcastRoom(roomMgr: RoomManager, roomId: string, message: ServerMessage, excludePeerId?: string): void {
    const participants = roomMgr.getRoomParticipants(roomId);
    for (const participant of participants) {
      if (excludePeerId && participant.peerId === excludePeerId) continue;
      const connection = connections.get(participant.connectionId);
      if (connection) {
        send(connection.ws, message);
      }
    }
  }
}

function send(ws: WebSocket, message: ServerMessage): void {
  const safeMessage = sanitizeForLogs(message);
  log.debug({ msg: safeMessage }, 'ws_send');
  ws.send(JSON.stringify(message));
}

function sendError(ws: WebSocket, code: string, message: string): void {
  send(ws, { type: 'signal_error', code, message });
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
