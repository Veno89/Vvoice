export class SlidingWindowRateLimiter {
    burst;
    windowMs;
    hits = new Map();
    constructor(burst, windowMs) {
        this.burst = burst;
        this.windowMs = windowMs;
    }
    consume(key) {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        const events = this.hits.get(key) ?? [];
        const fresh = events.filter((ts) => ts >= windowStart);
        if (fresh.length >= this.burst) {
            this.hits.set(key, fresh);
            return false;
        }
        fresh.push(now);
        this.hits.set(key, fresh);
        return true;
    }
    clear(key) {
        this.hits.delete(key);
    }
}
