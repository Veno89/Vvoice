import { describe, expect, test } from 'vitest';
import { clientMessageSchema, protocolVersion } from '../src/types/protocol.js';
describe('protocol validation', () => {
    test('accepts valid join_room payload', () => {
        const parsed = clientMessageSchema.safeParse({
            type: 'join_room',
            roomId: 'dev-room',
            displayName: 'Alice'
        });
        expect(parsed.success).toBe(true);
    });
    test('rejects invalid message shape', () => {
        const parsed = clientMessageSchema.safeParse({
            type: 'webrtc_offer',
            toPeerId: 'peer-1'
        });
        expect(parsed.success).toBe(false);
    });
    test('tracks protocol version constant', () => {
        expect(protocolVersion).toBe('1.0.0');
    });
});
