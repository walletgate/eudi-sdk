import { describe, it, expect, vi } from 'vitest';
import { buildDeepLinkUrl, makeQrDataUrl } from '..';

describe('SDK helpers', () => {
  it('buildDeepLinkUrl validates and returns the URL', () => {
    expect(buildDeepLinkUrl('https://wallet.example/req')).toBe('https://wallet.example/req');
    expect(() => buildDeepLinkUrl('')).toThrow();
    expect(() => buildDeepLinkUrl('not-a-url')).toThrow();
  });

  it('makeQrDataUrl uses optional qrcode dependency', async () => {
    const toDataURL = vi.fn().mockResolvedValue('data:image/png;base64,XXXX');
    ;(globalThis as any).__WG_QR = { toDataURL };
    const data = await makeQrDataUrl('https://example.com');
    expect(data.startsWith('data:image')).toBe(true);
  });
});
