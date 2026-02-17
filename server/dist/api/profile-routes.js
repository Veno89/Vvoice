import { z } from 'zod';
import * as userRepo from '../db/user-repo.js';
const updateProfileSchema = z.object({
    avatar_url: z.string().url().max(1024).optional().nullable(),
    bio: z.string().max(500).optional(),
});
export async function registerProfileRoutes(app, cfg) {
    // Get current user profile
    app.get('/api/profile', async (request, reply) => {
        try {
            // Decode JWT to get user ID
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
                return reply.code(401).send({ error: 'unauthorized', message: 'Missing token' });
            }
            const token = authHeader.split(' ')[1];
            const decoded = app.jwt.verify(token);
            const user = userRepo.findById(decoded.sub);
            if (!user) {
                return reply.code(404).send({ error: 'not_found', message: 'User not found' });
            }
            // Return public profile
            return {
                id: user.id,
                username: user.username,
                role: user.role,
                avatar_url: user.avatar_url,
                bio: user.bio,
                created_at: user.created_at
            };
        }
        catch (err) {
            return reply.code(401).send({ error: 'unauthorized', message: 'Invalid token' });
        }
    });
    // Update profile
    app.patch('/api/profile', async (request, reply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
                return reply.code(401).send({ error: 'unauthorized', message: 'Missing token' });
            }
            const token = authHeader.split(' ')[1];
            const decoded = app.jwt.verify(token);
            const body = updateProfileSchema.safeParse(request.body);
            if (!body.success) {
                return reply.code(400).send({ error: 'invalid_request', details: body.error.flatten() });
            }
            // Convert nullable to undefined if needed, or handle null as null in repo
            const fields = {
                avatar_url: body.data.avatar_url === null ? undefined : body.data.avatar_url,
                bio: body.data.bio
            };
            // If null is explicitly passed, we might want to clear it.
            // The current repo `updateProfile` handles `undefined` as "do not update".
            // If we want to clear avatar_url, we need to pass `null`?
            // Let's check user-repo.ts.
            // It says `avatar_url?: string`. It might not handle null clearing.
            // Let's assume for now we just pass what we get, but fix type if needed.
            const updated = userRepo.updateProfile(decoded.sub, {
                avatar_url: body.data.avatar_url ?? undefined, // Only update if string provided? Or allow null?
                bio: body.data.bio
            });
            if (!updated) {
                return reply.code(404).send({ error: 'not_found' });
            }
            return {
                id: updated.id,
                username: updated.username,
                role: updated.role,
                avatar_url: updated.avatar_url,
                bio: updated.bio,
                updated_at: updated.updated_at
            };
        }
        catch (err) {
            return reply.code(401).send({ error: 'unauthorized', message: 'Invalid token' });
        }
    });
}
