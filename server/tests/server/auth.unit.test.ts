import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '../../src/security/auth';

describe('Auth Security', () => {
    const SECRET = 'test-secret';

    it('generates a valid token', () => {
        const token = signToken(SECRET, 'u1', 'alice');
        expect(typeof token).toBe('string');

        const claims = verifyToken(SECRET, token);
        expect(claims.sub).toBe('u1');
        expect(claims.name).toBe('alice');
    });

    it('rejects invalid signature', () => {
        const token = signToken(SECRET, 'u1', 'alice');
        expect(() => {
            verifyToken('wrong-secret', token);
        }).toThrow(); // jwt throws JsonWebTokenError usually
    });

    it('rejects malformed token', () => {
        expect(() => {
            verifyToken(SECRET, 'not.a.token');
        }).toThrow();
    });

    it('rejects missing token', () => {
        expect(() => {
            verifyToken(SECRET, undefined);
        }).toThrow('missing_token');
    });
});
