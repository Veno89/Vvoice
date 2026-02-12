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

export const clientMessageSchema = z.discriminatedUnion('type', [
  clientHelloSchema,
  joinRoomSchema,
  leaveRoomSchema,
  offerSchema,
  answerSchema,
  iceCandidateSchema,
  setMuteSchema,
  pingSchema
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export interface ParticipantView {
  peerId: string;
  userId: string;
  displayName: string;
  muted: boolean;
}

export type ServerMessage =
  | { type: 'room_joined'; roomId: string; selfPeerId: string; participants: ParticipantView[] }
  | { type: 'participant_joined'; roomId: string; peerId: string; displayName: string; muted: boolean }
  | { type: 'participant_left'; roomId: string; peerId: string }
  | { type: 'participant_muted'; roomId: string; peerId: string; muted: boolean }
  | { type: 'webrtc_offer'; fromPeerId: string; sdp: string }
  | { type: 'webrtc_answer'; fromPeerId: string; sdp: string }
  | { type: 'webrtc_ice_candidate'; fromPeerId: string; candidate: string }
  | { type: 'pong'; ts: number }
  | { type: 'signal_error'; code: string; message: string }
  | { type: 'server_notice'; message: string };
