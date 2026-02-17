import { getDb } from './database.js';

export interface ChannelRow {
    id: string;
    name: string;
    description: string;
    position: number;
    protected: number;  // 0 or 1 (SQLite boolean)
    created_at: string;
}

export function listChannels(): ChannelRow[] {
    const db = getDb();
    return db.prepare('SELECT * FROM channels ORDER BY position ASC').all() as ChannelRow[];
}

export function createChannel(name: string, description = ''): ChannelRow {
    const db = getDb();
    // Get next position
    const maxPos = db.prepare('SELECT MAX(position) as mp FROM channels').get() as { mp: number | null };
    const position = (maxPos.mp ?? -1) + 1;
    // Generate next ID (max existing + 1)
    const maxId = db.prepare('SELECT MAX(CAST(id AS INTEGER)) as mi FROM channels').get() as { mi: number | null };
    const id = String((maxId.mi ?? 0) + 1);

    db.prepare(`
    INSERT INTO channels (id, name, description, position) VALUES (?, ?, ?, ?)
  `).run(id, name, description, position);

    return db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as ChannelRow;
}

export function deleteChannel(channelId: string): boolean {
    const db = getDb();
    // Check if protected
    const ch = db.prepare('SELECT protected FROM channels WHERE id = ?').get(channelId) as { protected: number } | undefined;
    if (!ch || ch.protected === 1) return false;

    const result = db.prepare('DELETE FROM channels WHERE id = ?').run(channelId);
    return result.changes > 0;
}

export function renameChannel(channelId: string, name: string): ChannelRow | null {
    const db = getDb();
    const result = db.prepare('UPDATE channels SET name = ? WHERE id = ?').run(name, channelId);
    if (result.changes === 0) return null;
    return db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId) as ChannelRow;
}

export function getChannel(channelId: string): ChannelRow | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId) as ChannelRow | undefined;
    return row ?? null;
}
