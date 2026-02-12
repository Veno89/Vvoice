export class SlidingWindowRateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private readonly burst: number, private readonly windowMs: number) {}

  consume(key: string): boolean {
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

  clear(key: string): void {
    this.hits.delete(key);
  }
}
