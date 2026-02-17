import { getDb } from './database.js';
export function saveMessage(channelId, userId, userName, content) {
    const db = getDb();
    db.prepare(`
    INSERT INTO messages (channel_id, user_id, user_name, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(channelId, userId, userName, content, Date.now());
}
export function getRecentMessages(channelId, limit = 50) {
    const db = getDb();
    // We want the *last* N messages, ordered by time ascending (oldest first)
    const rows = db.prepare(`
    SELECT * FROM (
      SELECT * FROM messages
      WHERE channel_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    ) ORDER BY created_at ASC
  `).all(channelId, limit);
    return rows;
}
