export interface VerificationCheck {
  type: 'age_over' | 'residency_in' | 'name_match';
  value?: number | string | string[];
  passed?: boolean;
}

export interface VerificationSession {
  id: string;
  merchantId: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  checks: VerificationCheck[];
  metadata?: Record<string, unknown>;
  redirectUrl?: string;
  walletRequestUrl?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface VerificationResult {
  sessionId: string;
  approved: boolean;
  checks: VerificationCheck[];
  auditRef: string;
  timestamp: Date;
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
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
  requestId: string;
}