import { randomUUID } from 'node:crypto';
import { getDb } from './database.js';
export function createUser(username, passwordHash, role = 'member') {
    const id = randomUUID();
    const db = getDb();
    db.prepare(`
    INSERT INTO users (id, username, password, role, is_banned) VALUES (?, ?, ?, ?, 0)
  `).run(id, username, passwordHash, role);
    return findById(id);
}
export function findByUsername(username) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    return row ?? null;
}
export function findById(id) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return row ?? null;
}
export function banUser(userId) {
    const db = getDb();
    db.prepare('UPDATE users SET is_banned = 1 WHERE id = ?').run(userId);
}
export function updateProfile(userId, fields) {
    const db = getDb();
    const sets = [];
    const values = [];
    if (fields.avatar_url !== undefined) {
        sets.push('avatar_url = ?');
        values.push(fields.avatar_url);
    }
    if (fields.bio !== undefined) {
        sets.push('bio = ?');
        values.push(fields.bio);
    }
    if (sets.length === 0)
        return findById(userId);
    sets.push("updated_at = datetime('now')");
    values.push(userId);
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return findById(userId);
}
