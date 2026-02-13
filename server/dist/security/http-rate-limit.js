import { SlidingWindowRateLimiter } from './rate-limiter.js';
const limiter = new SlidingWindowRateLimiter(120, 60_000);
export function applyHttpRateLimit(request, reply, done) {
    const key = request.ip;
    if (!limiter.consume(key)) {
        reply.code(429).send({ error: 'rate_limited', message: 'Too many requests' });
        return;
    }
    done();
}
