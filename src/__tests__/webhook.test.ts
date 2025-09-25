import { describe, it, expect } from 'vitest';
import { WalletGate } from '..';

describe('verifyWebhook (Node-only)', () => {
  it('verifies HMAC signature and timestamp window', async () => {
    const wg = new WalletGate({ apiKey: 'wg' });
    const payload = JSON.stringify({ hello: 'world' });
    const secret = 'shhh';
    const crypto = await import('crypto');
    // Inject node crypto to avoid require() in test env
    (globalThis as any).__WG_NODE_CRYPTO = crypto as any;
    const signature = (crypto as any).createHmac('sha256', secret).update(payload).digest('base64');
    const timestamp = String(Date.now());

    const ok = wg.verifyWebhook(payload, signature, secret, timestamp);
    expect(ok).toBe(true);

    const tooOld = String(Date.now() - 10 * 60_000);
    const expired = wg.verifyWebhook(payload, signature, secret, tooOld);
    expect(expired).toBe(false);
  });
});
