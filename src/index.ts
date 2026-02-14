/* SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2025 WalletGate
 */

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
  createHmac: (
    alg: string,
    secret: string
  ) => {
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

export type StartVerificationOptions = {
  idempotencyKey?: string;
};

export class WalletGateApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;
  readonly body?: unknown;

  constructor(args: {
    message: string;
    status: number;
    code?: string;
    details?: unknown;
    body?: unknown;
  }) {
    super(args.message);
    this.name = 'WalletGateApiError';
    this.status = args.status;
    this.code = args.code;
    this.details = args.details;
    this.body = args.body;
  }
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

  async startVerification(
    input: CreateSessionInput,
    opts?: StartVerificationOptions
  ): Promise<VerificationSession> {
    const headers: Record<string, string> = {};
    if (opts?.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
    const response = await this.request<VerificationSession>('/v1/verify/sessions', {
      method: 'POST',
      body: JSON.stringify(input),
      headers,
    });
    return response;
  }

  async getResult(sessionId: string): Promise<VerificationResult> {
    const response = await this.request<VerificationResult>(`/v1/verify/sessions/${sessionId}`, {
      method: 'GET',
    });
    return response;
  }

  verifyWebhook(rawBody: string, signature: string, secret: string, timestamp: string): boolean {
    const isNode =
      typeof process !== 'undefined' &&
      !!(process as unknown as { versions?: { node?: string } }).versions?.node;
    if (!isNode) throw new Error('verifyWebhook is only supported in Node environments');
    const injected = (globalThis as unknown as { __WG_NODE_CRYPTO?: NodeCryptoLike })
      .__WG_NODE_CRYPTO;
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
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              ...options.headers,
            },
            signal: controller.signal,
          });

          if (!response.ok) {
            const body = (await safeJson(response)) as
              | (RateLimitInfo & {
                  code?: string;
                  error?: string;
                  message?: string;
                  details?: unknown;
                })
              | Record<string, unknown>
              | null;
            const msgFromBody =
              body && typeof body === 'object'
                ? typeof (body as any).error === 'string'
                  ? (body as any).error
                  : typeof (body as any).message === 'string'
                    ? (body as any).message
                    : undefined
                : undefined;
            const code =
              body && typeof body === 'object' && typeof (body as any).code === 'string'
                ? String((body as any).code)
                : undefined;
            const details = body && typeof body === 'object' ? (body as any).details : undefined;

            if (response.status >= 400 && response.status < 500) {
              if (code === 'RATE_LIMIT_EXCEEDED') {
                const info: RateLimitInfo = {
                  message:
                    (body &&
                    typeof body === 'object' &&
                    (typeof (body as any).error === 'string' ||
                      typeof (body as any).message === 'string')
                      ? (body as any).error || (body as any).message
                      : undefined) || 'Rate limit exceeded',
                  retryAfterSeconds:
                    body &&
                    typeof body === 'object' &&
                    typeof (body as any).retryAfterSeconds === 'number'
                      ? (body as any).retryAfterSeconds
                      : undefined,
                  monthlyLimit:
                    body &&
                    typeof body === 'object' &&
                    typeof (body as any).monthlyLimit === 'number'
                      ? (body as any).monthlyLimit
                      : undefined,
                  dailyLimit:
                    body && typeof body === 'object' && typeof (body as any).dailyLimit === 'number'
                      ? (body as any).dailyLimit
                      : undefined,
                  upgradeUrl:
                    body && typeof body === 'object' && typeof (body as any).upgradeUrl === 'string'
                      ? (body as any).upgradeUrl
                      : undefined,
                };
                try {
                  this.onRateLimit && this.onRateLimit(info);
                } catch {
                  void 0;
                }
                const details: string[] = [];
                if (info.retryAfterSeconds)
                  details.push(`retry after ~${Math.ceil(info.retryAfterSeconds)}s`);
                if (info.monthlyLimit) details.push(`plan limit: ${info.monthlyLimit}/mo`);
                if (info.dailyLimit) details.push(`daily cap: ${info.dailyLimit}/24h`);
                const hint = info.upgradeUrl ? ` — upgrade: ${info.upgradeUrl}` : '';
                const msg = `Rate limit exceeded (${details.join(', ')})${hint}`;
                throw new WalletGateApiError({
                  message: msg,
                  status: response.status,
                  code,
                  details,
                  body,
                });
              }
              throw new WalletGateApiError({
                message: msgFromBody || `Request failed with status ${response.status}`,
                status: response.status,
                code,
                details,
                body,
              });
            }
            throw new WalletGateApiError({
              message: msgFromBody || `Server error (${response.status})`,
              status: response.status,
              code,
              details,
              body,
            });
          }
          const raw = (await safeJson(response)) as Record<string, unknown> | null;
          // Backend wraps successful responses in { success: true, data: {...} }
          if (raw && typeof raw === 'object' && 'success' in raw && 'data' in raw) {
            return raw.data as T;
          }
          return raw as T;
        } catch (e) {
          if (e instanceof WalletGateApiError && e.status < 500) throw e;
          if (controller.signal.aborted || attempt >= this.retries.maxRetries) throw e;
          await delay(
            this.retries.baseDelayMs * Math.pow(this.retries.factor, attempt),
            this.retries.jitter
          );
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
