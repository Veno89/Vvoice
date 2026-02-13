import { describe, expect, test } from 'vitest';
import { RoomManager } from '../src/domain/room-manager.js';

describe('RoomManager', () => {
  test('joins and lists participants', () => {
    const manager = new RoomManager(8, 2);
    const first = manager.joinRoom('conn-1', 'user-1', 'Alice', 'room-a');
    expect(first.participants).toHaveLength(0);

    const second = manager.joinRoom('conn-2', 'user-2', 'Bob', 'room-a');
    expect(second.participants).toHaveLength(1);
    expect(second.participants[0].displayName).toBe('Alice');
  });

  test('enforces max rooms per connection', () => {
    const manager = new RoomManager(8, 1);
    manager.joinRoom('conn-1', 'user-1', 'Alice', 'room-a');
    expect(() => manager.joinRoom('conn-1', 'user-1', 'Alice', 'room-b')).toThrow('max_rooms_per_connection');
  });

  test('enforces room size cap', () => {
    const manager = new RoomManager(1, 2);
    manager.joinRoom('conn-1', 'user-1', 'Alice', 'room-a');
    expect(() => manager.joinRoom('conn-2', 'user-2', 'Bob', 'room-a')).toThrow('room_full');
  });
});
