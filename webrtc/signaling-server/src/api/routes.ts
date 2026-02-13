import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ServerConfig } from '../config.js';
import { signDevToken } from '../security/auth.js';

const devAuthSchema = z.object({ username: z.string().min(1).max(64) });

const loginSchema = z.object({
  username: z.string().min(1).max(50)
});

export async function registerApiRoutes(app: FastifyInstance, cfg: ServerConfig): Promise<void> {
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  app.post('/api/auth/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'Invalid username' });
    }
    const token = signDevToken(cfg.jwtSecret, body.data.username);
    return { token };
  });

  app.post('/auth/dev', async (request, reply) => {
    const parsed = devAuthSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const token = signDevToken(cfg.jwtSecret, parsed.data.username.trim());
    return { token, tokenType: 'Bearer' };
  });
}
