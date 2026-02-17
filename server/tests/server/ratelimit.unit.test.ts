import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SlidingWindowRateLimiter } from '../../src/security/rate-limiter';

describe('SlidingWindowRateLimiter', () => {
    let limiter: SlidingWindowRateLimiter;

    beforeEach(() => {
        vi.useFakeTimers();
        limiter = new SlidingWindowRateLimiter(2, 1000); // 2 requests per 1000ms
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('allows requests within limit', () => {
        expect(limiter.consume('user-1')).toBe(true);
        expect(limiter.consume('user-1')).toBe(true);
    });

    it('blocks requests exceeding limit', () => {
        limiter.consume('user-1');
        limiter.consume('user-1');
        expect(limiter.consume('user-1')).toBe(false);
    });

    it('resets window after time passes', () => {
        limiter.consume('user-1');
        limiter.consume('user-1');
        expect(limiter.consume('user-1')).toBe(false);

        vi.advanceTimersByTime(1001);

        expect(limiter.consume('user-1')).toBe(true);
    });

    it('tracks separate keys independently', () => {
        limiter.consume('user-1');
        limiter.consume('user-1');
        expect(limiter.consume('user-1')).toBe(false);

        expect(limiter.consume('user-2')).toBe(true);
    });
});
