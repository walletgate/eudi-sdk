/* SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2025 WalletGate
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { WalletGate } from '..';

const originalFetch = globalThis.fetch;

describe('WalletGate retries', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch as any;
  });

  it('retries on 5xx and succeeds', async () => {
    const wg = new WalletGate({
      apiKey: 'wg',
      baseUrl: 'https://api.local',
      retries: { maxRetries: 2, baseDelayMs: 1, factor: 1, jitter: false },
    });
    const responses = [
      { ok: false, status: 500, json: async () => ({ message: 'err1' }) },
      { ok: false, status: 502, json: async () => ({ message: 'err2' }) },
      { ok: true, json: async () => ({ success: true, data: { id: 's1' } }) },
    ];
    let call = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => responses[call++]) as any;

    const res = await wg.startVerification({ checks: [{ type: 'age_over', value: 18 }] } as any);
    expect(res.id).toBe('s1');
    expect((globalThis.fetch as any).mock.calls.length).toBe(3);
  });

  it('does not retry on 4xx', async () => {
    const wg = new WalletGate({
      apiKey: 'wg',
      baseUrl: 'https://api.local',
      retries: { maxRetries: 3, baseDelayMs: 1, factor: 1, jitter: false },
    });
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 400, json: async () => ({ message: 'bad' }) }) as any;
    await expect(wg.startVerification({ checks: [] as any })).rejects.toThrow('bad');
    expect((globalThis.fetch as any).mock.calls.length).toBe(1);
  });
});
