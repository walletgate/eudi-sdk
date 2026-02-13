/* SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2025 WalletGate
 */

import { z } from 'zod';

export const VerificationCheckSchema = z.object({
  type: z.enum(['age_over', 'residency_eu', 'identity_verified']),
  value: z.union([z.number(), z.string()]).optional(),
});

export const CreateSessionSchema = z.object({
  checks: z.array(VerificationCheckSchema).min(1).max(10),
  redirectUrl: z.string().url().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  webhookUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
  enableAI: z.boolean().optional(),
});

export const WebhookPayloadSchema = z.object({
  event: z.string(),
  sessionId: z.string(),
  merchantId: z.string(),
  data: z.record(z.unknown()),
  timestamp: z.string().datetime(),
});

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;
