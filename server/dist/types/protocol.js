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
