import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChannelManager } from '../domain/channel-manager.js';
import { initDatabase, closeDatabase } from '../db/database.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { existsSync, unlinkSync } from 'fs';
describe('ChannelManager', () => {
    let dbPath;
    let manager;
    beforeEach(() => {
        dbPath = join(tmpdir(), `vvoice-test-${randomUUID()}.db`);
        initDatabase(dbPath);
        manager = new ChannelManager();
    });
    afterEach(() => {
        closeDatabase();
        if (existsSync(dbPath)) {
            try {
                unlinkSync(dbPath);
            }
            catch { }
        }
    });
    it('should list default channels', () => {
        const channels = manager.listChannels();
        expect(channels.length).toBeGreaterThanOrEqual(3);
        expect(channels.find(c => c.name === 'Lobby')).toBeDefined();
    });
    it('should create and delete a channel', () => {
        const newChannel = manager.createChannel('Test Room', 'Testing');
        expect(newChannel.name).toBe('Test Room');
        expect(manager.getChannel(newChannel.id)).toBeDefined();
        const deleted = manager.deleteChannel(newChannel.id);
        expect(deleted).toBe(true);
        expect(manager.getChannel(newChannel.id)).toBeUndefined();
    });
    it('should not delete protected Lobby', () => {
        // Lobby is ID 1
        const deleted = manager.deleteChannel('1');
        expect(deleted).toBe(false);
        expect(manager.getChannel('1')).toBeDefined();
    });
    it('should rename a channel', () => {
        const ch = manager.createChannel('Old Name');
        const updated = manager.renameChannel(ch.id, 'New Name');
        expect(updated?.name).toBe('New Name');
        expect(manager.getChannel(ch.id)?.name).toBe('New Name');
    });
});
