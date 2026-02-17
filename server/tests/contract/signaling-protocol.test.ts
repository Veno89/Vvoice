import { describe, it, expect } from 'vitest';
import { clientMessageSchema, protocolVersion } from '../../src/types/protocol';

describe('Signaling Protocol Contract', () => {
    it('validates a correct client_hello message', () => {
        const validHello = {
            type: 'client_hello',
            protocolVersion: protocolVersion,
            clientId: 'test-client-123',
        };
        const result = clientMessageSchema.safeParse(validHello);
        expect(result.success).toBe(true);
    });

    it('validates a correct join_room message', () => {
        const validJoin = {
            type: 'join_room',
            roomId: 'room-abc',
            displayName: 'Alice',
        };
        const result = clientMessageSchema.safeParse(validJoin);
        expect(result.success).toBe(true);
    });

    it('rejects join_room with empty roomId', () => {
        const invalidJoin = {
            type: 'join_room',
            roomId: '',
            displayName: 'Alice',
        };
        const result = clientMessageSchema.safeParse(invalidJoin);
        expect(result.success).toBe(false);
    });

    it('validates a correct webrtc_offer message', () => {
        const validOffer = {
            type: 'webrtc_offer',
            toPeerId: 'peer-target-1',
            sdp: 'v=0\r\no=...'
        };
        const result = clientMessageSchema.safeParse(validOffer);
        expect(result.success).toBe(true);
    });

    it('validates a correct webrtc_answer message', () => {
        const validAnswer = {
            type: 'webrtc_answer',
            toPeerId: 'peer-source-1',
            sdp: 'v=0\r\no=...'
        };
        const result = clientMessageSchema.safeParse(validAnswer);
        expect(result.success).toBe(true);
    });

    it('validates a correct webrtc_ice_candidate message', () => {
        const validIC = {
            type: 'webrtc_ice_candidate',
            toPeerId: 'peer-target-1',
            candidate: 'candidate:...'
        };
        const result = clientMessageSchema.safeParse(validIC);
        expect(result.success).toBe(true);
    });

    it('validates a correct set_mute message', () => {
        const validMute = {
            type: 'set_mute',
            roomId: 'room-1',
            muted: true
        };
        const result = clientMessageSchema.safeParse(validMute);
        expect(result.success).toBe(true);
    });

    it('rejects unknown message types', () => {
        const unknownMsg = {
            type: 'hack_the_planet',
            payload: 'boom'
        };
        const result = clientMessageSchema.safeParse(unknownMsg);
        expect(result.success).toBe(false);
    });

    it('rejects invalid payload types (e.g. number for string)', () => {
        const invalidType = {
            type: 'join_room',
            roomId: 12345, // should be string
            displayName: 'Bob'
        };
        const result = clientMessageSchema.safeParse(invalidType);
        expect(result.success).toBe(false);
    });
});
