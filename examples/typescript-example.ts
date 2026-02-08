/* SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2025 WalletGate
 */

/**
 * TypeScript usage example of the WalletGate EUDI SDK
 *
 * This example demonstrates type-safe usage of the SDK
 */

import { WalletGate, VerificationSession, VerificationResult, CreateSessionInput, WalletGateConfig, RateLimitInfo } from '@walletgate/eudi';

const config: WalletGateConfig = {
  apiKey: process.env.WALLETGATE_API_KEY || 'your-api-key',
  timeout: 30000,
  retries: {
    maxRetries: 3,
    baseDelayMs: 1000,
    factor: 2,
    jitter: true
  },
  onRateLimit: (info: RateLimitInfo) => {
    console.warn('Rate limit hit:', info.message);
    if (info.upgradeUrl) {
      console.log('Consider upgrading:', info.upgradeUrl);
    }
  }
};

class VerificationService {
  private client: WalletGate;

  constructor() {
    this.client = new WalletGate(config);
  }

  async startAgeVerification(minAge: number, userId: string): Promise<VerificationSession> {
    const sessionInput: CreateSessionInput = {
      checks: [
        { type: 'age_over', value: minAge }
      ],
      redirectUrl: `https://yourapp.com/success?userId=${userId}`,
      webhookUrl: 'https://yourapp.com/webhook/verification',
      metadata: {
        userId,
        verificationType: 'age',
        minAge,
        requestedAt: new Date().toISOString()
      },
      enableAI: true
    };

    try {
      const session: VerificationSession = await this.client.startVerification(sessionInput);
      console.log(`Age verification session started for user ${userId}`);
      console.log(`Session ID: ${session.id}`);
      console.log(`Expires at: ${session.expiresAt}`);

      return session;
    } catch (error: any) {
      console.error('Failed to start age verification:', error);
      throw error;
    }
  }

  async startIdentityVerification(userId: string): Promise<VerificationSession> {
    const sessionInput: CreateSessionInput = {
      checks: [
        { type: 'age_over', value: 18 },
        { type: 'residency_eu' },
        { type: 'identity_verified' }
      ],
      redirectUrl: `https://yourapp.com/kyc-success?userId=${userId}`,
      webhookUrl: 'https://yourapp.com/webhook/kyc',
      metadata: {
        userId,
        verificationType: 'full-identity',
        kycLevel: 'enhanced',
        requestedAt: new Date().toISOString()
      },
      enableAI: true
    };

    return this.client.startVerification(sessionInput);
  }

  async getVerificationResult(sessionId: string): Promise<VerificationResult> {
    try {
      const result = await this.client.getResult(sessionId);

      console.log(`Session ${result.id} - Status: ${result.status}`);
      if (typeof result.riskScore === 'number') {
        console.log(`Risk score: ${result.riskScore}`);
      }

      Object.entries(result.results || {}).forEach(([key, passed]) => {
        console.log(`${key}: ${passed ? '✅' : '❌'}`);
      });

      return result;
    } catch (error: any) {
      console.error('Failed to get verification result:', error);
      throw error;
    }
  }

  async waitForVerification(
    sessionId: string,
    maxWaitTimeMs: number = 300000,
    initialDelayMs: number = 1000
  ): Promise<VerificationResult> {
    const startTime: number = Date.now();
    let delay: number = initialDelayMs;

    while (Date.now() - startTime < maxWaitTimeMs) {
      const result: VerificationResult = await this.getVerificationResult(sessionId);

      if (['completed', 'failed', 'expired'].includes(result.status)) {
        return result;
      }

      console.log(`Waiting ${delay}ms before checking again...`);
      await new Promise<void>(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.5, 30000);
    }

    throw new Error(`Verification timeout after ${maxWaitTimeMs}ms`);
  }
}

async function main(): Promise<void> {
  const verificationService: VerificationService = new VerificationService();

  try {
    const session: VerificationSession = await verificationService.startAgeVerification(21, 'user-456');

    console.log('Waiting for user to complete verification...');
    const result: VerificationResult = await verificationService.waitForVerification(session.id);

    if (result.status === 'completed') {
      console.log('🎉 Verification successful!');
    } else {
      console.log('❌ Verification failed or expired');
    }

  } catch (error: any) {
    console.error('Verification process failed:', error);
  }
}

interface WebhookPayload {
  event: string;
  sessionId: string;
  merchantId: string;
  data: Record<string, boolean>;
  timestamp: string;
}

export {
  VerificationService,
  WebhookPayload,
  main
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
