import { describe, it, expect, vi, afterEach } from 'vitest';
import { WalletGate } from '..';

const originalFetch = globalThis.fetch;

describe('WalletGate SDK rate limit handling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch as any;
  });

  it('triggers onRateLimit and throws helpful message', async () => {
    const cb = vi.fn();
    const wg = new WalletGate({ apiKey: 'wg', baseUrl: 'https://api.local', onRateLimit: cb });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        retryAfterSeconds: 42,
        monthlyLimit: 1000,
        upgradeUrl: 'https://walletgate.app/#pricing'
      })
    }) as any;

    await expect(wg.startVerification({ checks: [{ type: 'age_over', value: 18 }] })).rejects.toThrow(/Rate limit exceeded/);
    expect(cb).toHaveBeenCalledTimes(1);
    const arg = cb.mock.calls[0][0];
    expect(arg.retryAfterSeconds).toBe(42);
    expect(arg.monthlyLimit).toBe(1000);
    expect(arg.upgradeUrl).toContain('walletgate');
  });
});

