import { getDb } from './database.js';
export function listChannels() {
    const db = getDb();
    return db.prepare('SELECT * FROM channels ORDER BY position ASC').all();
}
export function createChannel(name, description = '') {
    const db = getDb();
    // Get next position
    const maxPos = db.prepare('SELECT MAX(position) as mp FROM channels').get();
    const position = (maxPos.mp ?? -1) + 1;
    // Generate next ID (max existing + 1)
    const maxId = db.prepare('SELECT MAX(CAST(id AS INTEGER)) as mi FROM channels').get();
    const id = String((maxId.mi ?? 0) + 1);
    db.prepare(`
    INSERT INTO channels (id, name, description, position) VALUES (?, ?, ?, ?)
  `).run(id, name, description, position);
    return db.prepare('SELECT * FROM channels WHERE id = ?').get(id);
}
export function deleteChannel(channelId) {
    const db = getDb();
    // Check if protected
    const ch = db.prepare('SELECT protected FROM channels WHERE id = ?').get(channelId);
    if (!ch || ch.protected === 1)
        return false;
    const result = db.prepare('DELETE FROM channels WHERE id = ?').run(channelId);
    return result.changes > 0;
}
export function renameChannel(channelId, name) {
    const db = getDb();
    const result = db.prepare('UPDATE channels SET name = ? WHERE id = ?').run(name, channelId);
    if (result.changes === 0)
        return null;
    return db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
}
export function getChannel(channelId) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
    return row ?? null;
}
