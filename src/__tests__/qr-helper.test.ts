/* SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2025 WalletGate
 */

import { describe, it, expect } from 'vitest';
import { makeQrDataUrl, buildDeepLinkUrl } from '../helpers';

describe('QR and deep-link helpers', () => {
  it('validates deep-link URL', () => {
    expect(() => buildDeepLinkUrl('')).toThrow();
    expect(buildDeepLinkUrl('https://valid.example.com')).toBe('https://valid.example.com');
    expect(buildDeepLinkUrl('openid4vp://request?data=abc')).toBe('openid4vp://request?data=abc');
  });

  it('uses injected QR module when available', async () => {
    (globalThis as any).__WG_QR = { toDataURL: async (u: string) => `data:image/png;base64,${btoa(u)}` };
    const out = await makeQrDataUrl('https://x');
    expect(out.startsWith('data:image/png;base64,')).toBe(true);
    delete (globalThis as any).__WG_QR;
  });

  it('throws friendly error when QR not available', async () => {
    await expect(makeQrDataUrl('https://x')).rejects.toThrow(/QR generator not available/);
  });
});

