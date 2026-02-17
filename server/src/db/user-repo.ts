import { randomUUID } from 'node:crypto';
import { getDb } from './database.js';

export interface User {
    id: string;
    username: string;
    password: string;
    role: string;
    avatar_url: string | null;
    bio: string;
    is_banned: number;
    created_at: string;
    updated_at: string;
}

export function createUser(username: string, passwordHash: string, role = 'member'): User {
    const id = randomUUID();
    const db = getDb();
    db.prepare(`
    INSERT INTO users (id, username, password, role, is_banned) VALUES (?, ?, ?, ?, 0)
  `).run(id, username, passwordHash, role);

    return findById(id)!;
}

export function findByUsername(username: string): User | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
    return row ?? null;
}

export function findById(id: string): User | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
    return row ?? null;
}

export function banUser(userId: string): void {
    const db = getDb();
    db.prepare('UPDATE users SET is_banned = 1 WHERE id = ?').run(userId);
}

export function updateProfile(userId: string, fields: { avatar_url?: string; bio?: string }): User | null {
    const db = getDb();
    const sets: string[] = [];
    const values: unknown[] = [];

    if (fields.avatar_url !== undefined) {
        sets.push('avatar_url = ?');
        values.push(fields.avatar_url);
    }
    if (fields.bio !== undefined) {
        sets.push('bio = ?');
        values.push(fields.bio);
    }

    if (sets.length === 0) return findById(userId);

    sets.push("updated_at = datetime('now')");
    values.push(userId);

    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return findById(userId);
}
