import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as userRepo from '../db/user-repo.js';
import { initDatabase, closeDatabase } from '../db/database.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { existsSync, unlinkSync } from 'fs';
describe('UserRepo', () => {
    let dbPath;
    beforeEach(() => {
        dbPath = join(tmpdir(), `vvoice-test-user-${randomUUID()}.db`);
        initDatabase(dbPath);
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
    it('should create and find a user', () => {
        const user = userRepo.createUser('alice', 'hash123');
        expect(user.username).toBe('alice');
        expect(user.role).toBe('member');
        const found = userRepo.findByUsername('alice');
        expect(found?.id).toBe(user.id);
    });
    it('should fail on duplicate username', () => {
        userRepo.createUser('bob', 'hash1');
        expect(() => {
            userRepo.createUser('bob', 'hash2');
        }).toThrow(); // SqliteError: UNIQUE constraint failed
    });
    it('should update profile', () => {
        const user = userRepo.createUser('charlie', 'hash');
        const updated = userRepo.updateProfile(user.id, { bio: 'Hello world', avatar_url: 'http://img.com/1.png' });
        expect(updated?.bio).toBe('Hello world');
        expect(updated?.avatar_url).toBe('http://img.com/1.png');
        const fetched = userRepo.findById(user.id);
        expect(fetched?.bio).toBe('Hello world');
    });
});
