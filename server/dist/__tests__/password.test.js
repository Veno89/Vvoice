import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../security/password.js';
describe('Password Security', () => {
    it('should hash and verify correctly', async () => {
        const password = 'mySecretPassword123!';
        const hash = await hashPassword(password);
        expect(hash).not.toBe(password);
        expect(hash).toContain('$2b$'); // bcrypt prefix
        const valid = await verifyPassword(password, hash);
        expect(valid).toBe(true);
    });
    it('should reject wrong password', async () => {
        const password = 'password';
        const hash = await hashPassword(password);
        const valid = await verifyPassword('wrong', hash);
        expect(valid).toBe(false);
    });
});
