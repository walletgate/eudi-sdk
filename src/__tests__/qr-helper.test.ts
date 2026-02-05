/* SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2025 WalletGate
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildDeepLinkUrl } from '../helpers';

describe('QR and deep-link helpers', () => {
  beforeEach(() => {
    // Clean up any injected QR module
    delete (globalThis as any).__WG_QR;
  });

  afterEach(() => {
    delete (globalThis as any).__WG_QR;
    vi.restoreAllMocks();
  });

  it('validates deep-link URL', () => {
    expect(() => buildDeepLinkUrl('')).toThrow();
    expect(buildDeepLinkUrl('https://valid.example.com')).toBe('https://valid.example.com');
    expect(buildDeepLinkUrl('openid4vp://request?data=abc')).toBe('openid4vp://request?data=abc');
  });

  it('uses injected QR module when available', async () => {
    // Import fresh to ensure no cached dynamic import
    const { makeQrDataUrl } = await import('../helpers');
    (globalThis as any).__WG_QR = {
      toDataURL: async (u: string) => `data:image/png;base64,${btoa(u)}`,
    };
    const out = await makeQrDataUrl('https://x');
    expect(out.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('generates QR when qrcode package is available', async () => {
    // The qrcode package is available through monorepo hoisting
    // This test verifies the dynamic import path works
    const { makeQrDataUrl } = await import('../helpers');
    const out = await makeQrDataUrl('https://test.example.com');
    expect(out.startsWith('data:image/png;base64,')).toBe(true);
  });
});
