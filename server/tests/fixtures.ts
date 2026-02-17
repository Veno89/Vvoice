import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';

export const makeUser = (id?: string) => ({
    id: id || randomUUID(),
    name: `User-${id || randomUUID()}`,
});

export const makeRoom = (id?: string) => ({
    id: id || `room-${randomUUID()}`,
    name: 'Test Room',
});

export const makeValidMessage = (type: string, payload: any = {}) => ({
    type,
    payload,
    timestamp: Date.now(),
});

export const createTestClient = (port: number) => {
    return new WebSocket(`ws://localhost:${port}`);
};
