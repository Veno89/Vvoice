import { z } from 'zod';
import { signToken, verifyToken } from '../security/auth.js';
import { hashPassword, verifyPassword } from '../security/password.js';
import * as userRepo from '../db/user-repo.js';
const registerSchema = z.object({
    username: z.string().min(1).max(50).trim(),
    password: z.string().min(4).max(128),
});
const loginSchema = z.object({
    username: z.string().min(1).max(50).trim(),
    password: z.string().min(1).max(128),
});
export async function registerApiRoutes(app, cfg, connections) {
    app.get('/health', async () => {
        return { status: 'ok', timestamp: new Date().toISOString() };
    });
    // Admin Middleware (Simplified for now, check role in handler)
    const requireAdmin = async (request, reply) => {
        const authHeader = request.headers.authorization;
        if (!authHeader)
            return reply.code(401).send({ error: 'unauthorized' });
        const token = authHeader.split(' ')[1];
        try {
            const claims = verifyToken(cfg.jwtSecret, token);
            if (claims.role !== 'admin') {
                return reply.code(403).send({ error: 'forbidden' });
            }
            request.user = claims; // Attach user to request
        }
        catch (e) {
            return reply.code(401).send({ error: 'invalid_token' });
        }
    };
    // Kick User
    app.post('/api/admin/kick', { preHandler: requireAdmin }, async (request, reply) => {
        const { userId, reason } = z.object({ userId: z.string(), reason: z.string().optional() }).parse(request.body);
        // Find connections for user
        let kickedCount = 0;
        for (const [connId, state] of connections.entries()) {
            if (state.userId === userId) {
                state.ws.close(4000, reason || 'Kicked by admin');
                connections.delete(connId); // Clean up map immediately? WS close handler will do it too.
                kickedCount++;
            }
        }
        if (kickedCount === 0) {
            return reply.code(404).send({ error: 'user_not_connected', message: 'User is not currently connected' });
        }
        return { message: `Kicked ${kickedCount} connections` };
    });
    // Ban User
    app.post('/api/admin/ban', { preHandler: requireAdmin }, async (request, reply) => {
        const { userId, reason } = z.object({ userId: z.string(), reason: z.string().optional() }).parse(request.body);
        // 1. Kick existing connections
        for (const [_, state] of connections.entries()) {
            if (state.userId === userId) {
                state.ws.close(4008, reason || 'Banned by admin');
            }
        }
        // 2. Update DB (Need to implement banUser in repo)
        if (reason) {
            // Ideally log the reason somewhere
        }
        userRepo.banUser(userId);
        return { message: `User banned` };
    });
    // Register a new user
    app.post('/api/auth/register', async (request, reply) => {
        const body = registerSchema.safeParse(request.body);
        if (!body.success) {
            return reply.code(400).send({ error: 'invalid_request', details: body.error.flatten() });
        }
        const { username, password } = body.data;
        // Check if user already exists
        const existing = userRepo.findByUsername(username);
        if (existing) {
            return reply.code(409).send({ error: 'username_taken', message: 'Username already exists' });
        }
        const hash = await hashPassword(password);
        const user = userRepo.createUser(username, hash);
        const token = signToken(cfg.jwtSecret, user.id, user.username, user.role);
        return { token, user: { id: user.id, username: user.username, role: user.role } };
    });
    // Login with password
    app.post('/api/auth/login', async (request, reply) => {
        const body = loginSchema.safeParse(request.body);
        if (!body.success) {
            return reply.code(400).send({ error: 'invalid_request' });
        }
        const { username, password } = body.data;
        const user = userRepo.findByUsername(username);
        if (!user) {
            return reply.code(401).send({ error: 'invalid_credentials', message: 'Invalid username or password' });
        }
        const valid = await verifyPassword(password, user.password);
        if (!valid) {
            return reply.code(401).send({ error: 'invalid_credentials', message: 'Invalid username or password' });
        }
        // Check if banned
        if (user.is_banned > 0) {
            return reply.code(403).send({ error: 'banned', message: 'User is banned' });
        }
        const token = signToken(cfg.jwtSecret, user.id, user.username, user.role);
        return { token, user: { id: user.id, username: user.username, role: user.role } };
    });
    // Dev-only: passwordless login (auto-creates user)
    if ((process.env.NODE_ENV ?? 'development') === 'development') {
        app.post('/auth/dev', async (request, reply) => {
            const parsed = z.object({ username: z.string().min(1).max(64) }).safeParse(request.body);
            if (!parsed.success) {
                return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
            }
            const username = parsed.data.username.trim();
            let user = userRepo.findByUsername(username);
            if (!user) {
                const hash = await hashPassword('dev-password');
                user = userRepo.createUser(username, hash, 'admin');
            }
            const token = signToken(cfg.jwtSecret, user.id, user.username, user.role);
            return { token, tokenType: 'Bearer' };
        });
    }
}
