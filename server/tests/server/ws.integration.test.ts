import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import { createTestServer } from '../integration-setup';
import { protocolVersion } from '../../src/types/protocol';

describe('WebSocket Integration', () => {
    let server: Awaited<ReturnType<typeof createTestServer>>;
    let clients: WebSocket[] = [];

    beforeEach(async () => {
        server = await createTestServer();
    });

    afterEach(async () => {
        clients.forEach(ws => ws.close());
        clients = [];
        await server.close();
    });

    const createClient = (token?: string) => {
        const ws = new WebSocket(`ws://localhost:${server.port}/ws`);
        clients.push(ws);

        return new Promise<WebSocket>((resolve) => {
            ws.on('open', () => {
                if (token) {
                    ws.send(JSON.stringify({
                        type: 'client_hello',
                        protocolVersion,
                        clientId: 'test-client',
                        authToken: token
                    }));
                }
                resolve(ws);
            });
        });
    };

    const waitForMessage = (ws: WebSocket, type: string) => {
        return new Promise<any>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error(`Timeout waiting for ${type}`)), 1000);
            ws.on('message', (raw) => {
                const msg = JSON.parse(raw.toString());
                if (msg.type === type) {
                    clearTimeout(timeout);
                    resolve(msg);
                }
            });
        });
    };

    it('connects and authenticates', async () => {
        const token = server.makeToken('alice');
        const ws = await createClient(token);

        const notice = await waitForMessage(ws, 'server_notice');
        expect(notice.message).toContain('Authenticated as alice');
    });

    it('joins a room and receives updates', async () => {
        const token = server.makeToken('bob');
        const ws = await createClient(token);

        // Wait for auth
        await waitForMessage(ws, 'server_notice');

        ws.send(JSON.stringify({
            type: 'join_room',
            roomId: 'room-1',
            displayName: 'Bob'
        }));

        const joined = await waitForMessage(ws, 'room_joined');
        expect(joined.roomId).toBe('room-1');
        expect(joined.selfPeerId).toBeDefined();
    });

    it('routes offer between peers', async () => {
        const token1 = server.makeToken('alice');
        const ws1 = await createClient(token1);
        await waitForMessage(ws1, 'server_notice');

        const token2 = server.makeToken('bob');
        const ws2 = await createClient(token2);
        await waitForMessage(ws2, 'server_notice');

        // Join room
        ws1.send(JSON.stringify({ type: 'join_room', roomId: 'duel-room', displayName: 'Alice' }));
        const joined1 = await waitForMessage(ws1, 'room_joined');

        ws2.send(JSON.stringify({ type: 'join_room', roomId: 'duel-room', displayName: 'Bob' }));
        const joined2 = await waitForMessage(ws2, 'room_joined');

        // Alice sends offer to Bob
        const offer = {
            type: 'webrtc_offer',
            toPeerId: joined2.selfPeerId,
            sdp: 'mock-sdp-content'
        };
        ws1.send(JSON.stringify(offer));

        // Bob should receive it
        const receivedOffer = await waitForMessage(ws2, 'webrtc_offer');
        expect(receivedOffer.fromPeerId).toBe(joined1.selfPeerId);
        expect(receivedOffer.sdp).toBe('mock-sdp-content');
    });

    it('enforces rate limits on broadcast', async () => {
        const token = server.makeToken('spammer');
        const ws = await createClient(token);
        await waitForMessage(ws, 'server_notice');

        // Send more than allowed (config burst is 10)
        const limit = 15;
        let closeReceived = false;

        ws.on('close', (code) => {
            if (code === 1008) closeReceived = true;
        });

        for (let i = 0; i < limit; i++) {
            ws.send(JSON.stringify({ type: 'ping' }));
        }

        // Allow some time for server to process and close
        await new Promise(r => setTimeout(r, 200));
        expect(closeReceived).toBe(true);
    });
});
