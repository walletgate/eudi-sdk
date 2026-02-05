/* SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2025 WalletGate
 */

export interface VerificationCheck {
  type: 'age_over' | 'residency_eu' | 'identity_verified';
  value?: number | string;
  passed?: boolean;
}

export interface VerificationSession {
  id: string;
  merchantId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired';
  checks: VerificationCheck[];
  metadata?: Record<string, unknown>;
  redirectUrl?: string;
  verificationUrl?: string;
  nonce?: string;
  environment?: 'test' | 'live';
  testMode?: boolean;
  warning?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationResult {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired';
  results?: Record<string, boolean>;
  riskScore?: number;
  aiInsights?: string[];
  environment?: 'test' | 'live';
  testMode?: boolean;
  warning?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKey {
  id: string;
  publicId: string;
  merchantId: string;
  environment: 'test' | 'live';
  name?: string;
  ipAllowlist?: string[];
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Webhook {
  id: string;
  merchantId: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}
