import { z } from 'zod';

export const protocolVersion = '1.0.0';

const baseSchema = z.object({
  type: z.string(),
  requestId: z.string().optional(),
  sentAt: z.number().optional()
});

export const clientHelloSchema = baseSchema.extend({
  type: z.literal('client_hello'),
  protocolVersion: z.string(),
  clientId: z.string().min(1).max(128),
  authToken: z.string().optional()
});

export const joinRoomSchema = baseSchema.extend({
  type: z.literal('join_room'),
  roomId: z.string().min(1).max(64),
  displayName: z.string().min(1).max(50)
});

export const leaveRoomSchema = baseSchema.extend({
  type: z.literal('leave_room'),
  roomId: z.string().min(1).max(64)
});

const sdpSchema = z.string().min(1).max(20000);
const candidateSchema = z.string().min(1).max(5000);

export const offerSchema = baseSchema.extend({
  type: z.literal('webrtc_offer'),
  toPeerId: z.string().min(1).max(128),
  sdp: sdpSchema
});

export const answerSchema = baseSchema.extend({
  type: z.literal('webrtc_answer'),
  toPeerId: z.string().min(1).max(128),
  sdp: sdpSchema
});

export const iceCandidateSchema = baseSchema.extend({
  type: z.literal('webrtc_ice_candidate'),
  toPeerId: z.string().min(1).max(128),
  candidate: candidateSchema
});

export const setMuteSchema = baseSchema.extend({
  type: z.literal('set_mute'),
  roomId: z.string().min(1).max(64),
  muted: z.boolean()
});

export const pingSchema = baseSchema.extend({
  type: z.literal('ping')
});

export const clientChatMessageSchema = baseSchema.extend({
  type: z.literal('chat_message'),
  roomId: z.string().min(1).max(64),
  content: z.string().min(1).max(2000)
});

export const createChannelSchema = baseSchema.extend({
  type: z.literal('create_channel'),
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional()
});

export const deleteChannelSchema = baseSchema.extend({
  type: z.literal('delete_channel'),
  channelId: z.string().min(1).max(64)
});

export const clientMessageSchema = z.discriminatedUnion('type', [
  clientHelloSchema,
  joinRoomSchema,
  leaveRoomSchema,
  offerSchema,
  answerSchema,
  iceCandidateSchema,
  setMuteSchema,
  pingSchema,
  clientChatMessageSchema,
  createChannelSchema,
  deleteChannelSchema
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export interface ParticipantView {
  peerId: string;
  userId: string;
  displayName: string;
  muted: boolean;
  avatarUrl?: string;
  bio?: string;
  role?: string;
}

export type ServerMessage =
  | { type: 'room_joined'; roomId: string; selfPeerId: string; participants: ParticipantView[]; iceServers: { urls: string; username?: string; credential?: string }[] }
  | { type: 'participant_joined'; roomId: string; peerId: string; displayName: string; muted: boolean; avatarUrl?: string; bio?: string; role?: string }
  | { type: 'participant_left'; roomId: string; peerId: string }
  | { type: 'participant_muted'; roomId: string; peerId: string; muted: boolean }
  | { type: 'chat_message'; roomId: string; senderId: string; displayName: string; content: string; timestamp: number }
  | { type: 'webrtc_offer'; fromPeerId: string; sdp: string }
  | { type: 'webrtc_answer'; fromPeerId: string; sdp: string }
  | { type: 'webrtc_ice_candidate'; fromPeerId: string; candidate: string }
  | { type: 'pong'; ts: number }
  | { type: 'signal_error'; code: string; message: string }
  | { type: 'server_notice'; message: string }
  | { type: 'channel_list'; channels: { id: string; name: string; description: string; position: number }[] };
