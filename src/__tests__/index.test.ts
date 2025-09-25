import { describe, it, expect, vi } from 'vitest';
import { WalletGate } from '..';

const originalFetch = globalThis.fetch;

describe('WalletGate SDK', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch as any;
  });

  it('adds Authorization header and calls correct URL', async () => {
    const wg = new WalletGate({ apiKey: 'wg_test_key', baseUrl: 'https://api.local' });
    const mockRes = { ok: true, json: async () => ({ id: 's1' }) };
    const spy = vi.fn().mockResolvedValue(mockRes);
    globalThis.fetch = spy as any;

    await wg.startVerification({ checks: [{ type: 'age_over', value: 18 }] });

    expect(spy).toHaveBeenCalledTimes(1);
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe('https://api.local/v1/verify/sessions');
    expect(init.headers['Authorization']).toContain('wg_test_key');
  });

  it('respects timeout and aborts', async () => {
    const wg = new WalletGate({ apiKey: 'wg', baseUrl: 'https://api.local', timeout: 10 });
    globalThis.fetch = vi.fn((url: string, init: any) => {
      const signal: AbortSignal | undefined = init?.signal;
      return new Promise((_resolve, reject) => {
        if (signal) {
          if (signal.aborted) {
            return reject(new DOMException('Aborted', 'AbortError'));
          }
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }
        // never resolve; will reject on abort
      });
    }) as any;
    await expect(wg.getResult('sess_1')).rejects.toThrow(/Aborted|abort/i);
  });

  it('propagates non-2xx errors with message', async () => {
    const wg = new WalletGate({ apiKey: 'wg', baseUrl: 'https://api.local' });
    const mockRes = { ok: false, status: 400, json: async () => ({ message: 'Bad data' }) };
    globalThis.fetch = vi.fn().mockResolvedValue(mockRes) as any;
    await expect(
      wg.startVerification({ checks: [] as any })
    ).rejects.toThrow('Bad data');
  });
});
