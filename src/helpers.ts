/*
 * Copyright 2025 WalletGate Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export function buildDeepLinkUrl(walletRequestUrl: string): string {
  if (typeof walletRequestUrl !== 'string' || walletRequestUrl.length === 0) {
    throw new Error('walletRequestUrl is required');
  }
  if (!/^https?:\/\//i.test(walletRequestUrl) && !/^[a-z][a-z0-9+.-]*:/i.test(walletRequestUrl)) {
    throw new Error('Invalid walletRequestUrl');
  }
  return walletRequestUrl;
}

export async function makeQrDataUrl(url: string): Promise<string> {
  if (typeof url !== 'string' || url.length === 0) throw new Error('URL required');
  const injected = (globalThis as { __WG_QR?: { toDataURL?: (url: string, opts: { margin: number; scale: number }) => Promise<string> } }).__WG_QR;
  if (injected && typeof injected.toDataURL === 'function') {
    return await injected.toDataURL(url, { margin: 1, scale: 4 });
  }
  try {
    const mod = await import('qrcode') as { toDataURL?: (url: string, opts: { margin: number; scale: number }) => Promise<string> };
    if (!mod || typeof mod.toDataURL !== 'function') throw new Error('qrcode.toDataURL not available');
    return await mod.toDataURL(url, { margin: 1, scale: 4 });
  } catch (e) {
    throw new Error('QR generator not available. Install optional peer dependency "qrcode" to enable QR generation.');
  }
}
