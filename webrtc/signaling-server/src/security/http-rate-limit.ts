import type { FastifyReply, FastifyRequest } from 'fastify';
import { SlidingWindowRateLimiter } from './rate-limiter.js';

const limiter = new SlidingWindowRateLimiter(120, 60_000);

export function applyHttpRateLimit(request: FastifyRequest, reply: FastifyReply, done: () => void): void {
  const key = request.ip;
  if (!limiter.consume(key)) {
    reply.code(429).send({ error: 'rate_limited', message: 'Too many requests' });
    return;
  }
  done();
}
