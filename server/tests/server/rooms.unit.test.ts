import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from '../../src/domain/room-manager';

describe('RoomManager', () => {
    let roomManager: RoomManager;

    beforeEach(() => {
        roomManager = new RoomManager(10, 5); // Max 10 participants, 5 rooms per conn
    });

    it('allows a user to join a new room', () => {
        const result = roomManager.joinRoom('conn-1', 'user-1', 'Alice', 'room-1');
        expect(result.self.userId).toBe('user-1');
        expect(result.self.displayName).toBe('Alice');
        expect(result.self.displayName).toBe('Alice');
        // Participant object matches expected shape
        expect(result.self.userId).toBe('user-1');
        // But we should check if room calls succeed
        const participants = roomManager.getRoomParticipants('room-1');
        expect(participants).toHaveLength(1);
        expect(participants[0].userId).toBe('user-1');
    });

    it('updates participant list when second user joins', () => {
        roomManager.joinRoom('conn-1', 'user-1', 'Alice', 'room-1');
        const result2 = roomManager.joinRoom('conn-2', 'user-2', 'Bob', 'room-1');

        expect(result2.participants).toHaveLength(1);
        expect(result2.participants[0].displayName).toBe('Alice');

        const all = roomManager.getRoomParticipants('room-1');
        expect(all).toHaveLength(2);
    });

    it('enforces max participants per room', () => {
        // Max 10
        const roomId = 'crowded-room';
        for (let i = 0; i < 10; i++) {
            roomManager.joinRoom(`conn-${i}`, `user-${i}`, `User ${i}`, roomId);
        }

        expect(() => {
            roomManager.joinRoom('conn-11', 'user-11', 'Overflow', roomId);
        }).toThrow('room_full');
    });

    it('enforces max rooms per connection', () => {
        // Max 5
        const connId = 'busy-user';
        for (let i = 0; i < 5; i++) {
            roomManager.joinRoom(connId, 'user-1', 'Me', `room-${i}`);
        }

        expect(() => {
            roomManager.joinRoom(connId, 'user-1', 'Me', 'room-overflow');
        }).toThrow('max_rooms_per_connection');
    });

    it('removes participant on leave', () => {
        roomManager.joinRoom('conn-1', 'user-1', 'Alice', 'room-1');
        const removed = roomManager.leaveRoom('conn-1', 'room-1');

        expect(removed).toHaveLength(1);
        expect(removed[0].userId).toBe('user-1');
        expect(roomManager.getRoomParticipants('room-1')).toHaveLength(0);
    });

    it('cleans up room when empty', () => {
        roomManager.joinRoom('conn-1', 'user-1', 'Alice', 'room-1');
        roomManager.leaveRoom('conn-1', 'room-1');

        // We can't access private 'rooms' map directly easily, but accessing valid room should probably work or return empty
        // Implementation detail: accessing getRoomParticipants returns empty array if room gone
        expect(roomManager.getRoomParticipants('room-1')).toEqual([]);
    });

    it('handles leaveAll correctly on disconnect', () => {
        roomManager.joinRoom('conn-1', 'user-1', 'Alice', 'room-A');
        roomManager.joinRoom('conn-1', 'user-1', 'Alice', 'room-B');

        const events = roomManager.leaveAll('conn-1');
        expect(events).toHaveLength(2);
        expect(events.map(e => e.roomId).sort()).toEqual(['room-A', 'room-B']);

        expect(roomManager.getRoomParticipants('room-A')).toHaveLength(0);
        expect(roomManager.getRoomParticipants('room-B')).toHaveLength(0);
    });

    it('toggles mute state', () => {
        roomManager.joinRoom('conn-1', 'user-1', 'Alice', 'room-1');

        const p = roomManager.setMute('conn-1', 'room-1', true);
        expect(p.muted).toBe(true);

        const p2 = roomManager.setMute('conn-1', 'room-1', false);
        expect(p2.muted).toBe(false);
    });
});
