import { describe, it, expect } from 'vitest';
import { signToken } from '../security/auth.js';
import jwt from 'jsonwebtoken';

describe('Auth', () => {
    const SECRET = 'test-secret';

    it('should sign a token with correct claims', () => {
        const token = signToken(SECRET, 'user-123', 'alice', 'admin');
        const decoded = jwt.verify(token, SECRET) as any;

        expect(decoded.sub).toBe('user-123');
        expect(decoded.name).toBe('alice');
        expect(decoded.role).toBe('admin');
    });

    it('should default role to member', () => {
        const token = signToken(SECRET, 'user-456', 'bob');
        const decoded = jwt.verify(token, SECRET) as any;
        expect(decoded.role).toBe('member');
    });
});
