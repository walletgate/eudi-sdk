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

import type { VerificationSession, VerificationResult } from './types';
import type { CreateSessionInput } from './schemas';

type NodeCryptoLike = {
  createHmac: (alg: string, secret: string) => {
    update: (data: string) => { digest: (fmt: 'base64') => string };
  };
  timingSafeEqual: (a: Buffer, b: Buffer) => boolean;
};

export interface WalletGateConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retries?: {
    maxRetries?: number;
    baseDelayMs?: number;
    factor?: number;
    jitter?: boolean;
  };
  onRateLimit?: (info: RateLimitInfo) => void;
}

export class WalletGate {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private retries: Required<NonNullable<WalletGateConfig['retries']>>;
  private onRateLimit?: (info: RateLimitInfo) => void;

  constructor(config: WalletGateConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.walletgate.app';
    this.timeout = config.timeout || 30000;
    const r = config.retries || {};
    this.retries = {
      maxRetries: r.maxRetries ?? 0,
      baseDelayMs: r.baseDelayMs ?? 200,
      factor: r.factor ?? 2,
      jitter: r.jitter ?? true,
    };
    this.onRateLimit = config.onRateLimit;
  }

  async startVerification(input: CreateSessionInput): Promise<VerificationSession> {
    const response = await this.request<VerificationSession>('/v1/verify/sessions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response;
  }

  async getResult(sessionId: string): Promise<VerificationResult> {
    const response = await this.request<VerificationResult>(`/v1/verify/sessions/${sessionId}`, {
      method: 'GET',
    });
    return response;
  }

  verifyWebhook(
    rawBody: string,
    signature: string,
    secret: string,
    timestamp: string
  ): boolean {
    const isNode = typeof process !== 'undefined' && !!(process as unknown as { versions?: { node?: string } }).versions?.node;
    if (!isNode) throw new Error('verifyWebhook is only supported in Node environments');
    const injected = (globalThis as unknown as { __WG_NODE_CRYPTO?: NodeCryptoLike }).__WG_NODE_CRYPTO;
    if (!injected) {
      throw new Error('Node crypto module not available');
    }
    const nodeCrypto: NodeCryptoLike = injected;
    const expected = nodeCrypto.createHmac('sha256', secret).update(rawBody).digest('base64');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    const ok = nodeCrypto.timingSafeEqual(a, b);
    if (!ok) return false;
    const age = Date.now() - parseInt(timestamp, 10);
    return age <= 5 * 60_000;
  }

  private async request<T>(path: string, options: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    let attempt = 0;
    try {
      for (;;) {
        try {
          const response = await fetch(`${this.baseUrl}${path}`, {
            ...options,
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              ...options.headers,
            },
            signal: controller.signal,
          });

          if (!response.ok) {
            if (response.status >= 400 && response.status < 500) {
              const err = (await safeJson(response)) as (RateLimitInfo & { code?: string }) | null;
              if (err && err.code === 'RATE_LIMIT_EXCEEDED') {
                const info: RateLimitInfo = {
                  message: err.message || 'Rate limit exceeded',
                  retryAfterSeconds: typeof err.retryAfterSeconds === 'number' ? err.retryAfterSeconds : undefined,
                  monthlyLimit: typeof err.monthlyLimit === 'number' ? err.monthlyLimit : undefined,
                  dailyLimit: typeof err.dailyLimit === 'number' ? err.dailyLimit : undefined,
                  upgradeUrl: typeof err.upgradeUrl === 'string' ? err.upgradeUrl : undefined,
                };
                try { this.onRateLimit && this.onRateLimit(info); } catch { void 0; }
                const details: string[] = [];
                if (info.retryAfterSeconds) details.push(`retry after ~${Math.ceil(info.retryAfterSeconds)}s`);
                if (info.monthlyLimit) details.push(`plan limit: ${info.monthlyLimit}/mo`);
                if (info.dailyLimit) details.push(`daily cap: ${info.dailyLimit}/24h`);
                const hint = info.upgradeUrl ? ` — upgrade: ${info.upgradeUrl}` : '';
                const msg = `Rate limit exceeded (${details.join(', ')})${hint}`;
                throw new NoRetryError(msg);
              }
              throw new NoRetryError((err && err.message) || `Request failed with status ${response.status}`);
            }
            const err5 = (await safeJson(response)) as { message?: string } | null;
            throw new Error((err5 && err5.message) || `Server error (${response.status})`);
          }
          const data = (await safeJson(response)) as T;
          return data;
        } catch (e) {
          if (e instanceof NoRetryError) throw e;
          if (controller.signal.aborted || attempt >= this.retries.maxRetries) throw e;
          await delay(this.retries.baseDelayMs * Math.pow(this.retries.factor, attempt), this.retries.jitter);
          attempt++;
          continue;
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function delay(ms: number, jitter: boolean): Promise<void> {
  const jitterMs = jitter ? Math.floor(Math.random() * (ms / 2)) : 0;
  return new Promise((resolve) => setTimeout(resolve, ms + jitterMs));
}

class NoRetryError extends Error {}

export * from './types';
export * from './schemas';
export * from './helpers';

export type RateLimitInfo = {
  message: string;
  retryAfterSeconds?: number;
  monthlyLimit?: number;
  dailyLimit?: number;
  upgradeUrl?: string;
};
