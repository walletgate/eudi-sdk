/**
 * TypeScript usage example of the WalletGate EUDI SDK
 *
 * This example demonstrates type-safe usage of the SDK
 */

import { WalletGate, VerificationSession, VerificationResult, CreateSessionInput } from '@walletgate/eudi';

// Define configuration with proper types
const config = {
  apiKey: process.env.WALLETGATE_API_KEY || 'your-api-key',
  baseUrl: process.env.WALLETGATE_BASE_URL || 'https://api.walletgate.app',
  timeout: 30000,
  retries: {
    maxRetries: 3,
    baseDelayMs: 1000,
    factor: 2,
    jitter: true
  },
  onRateLimit: (info) => {
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

  /**
   * Start an age verification session
   */
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
      const session = await this.client.startVerification(sessionInput);
      console.log(`Age verification session started for user ${userId}`);
      console.log(`Session ID: ${session.id}`);
      console.log(`Expires at: ${session.expiresAt}`);

      return session;
    } catch (error) {
      console.error('Failed to start age verification:', error);
      throw error;
    }
  }

  /**
   * Start a comprehensive identity verification
   */
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

    return await this.client.startVerification(sessionInput);
  }

  /**
   * Get verification result with type safety
   */
  async getVerificationResult(sessionId: string): Promise<VerificationResult> {
    try {
      const result = await this.client.getResult(sessionId);

      // Type-safe access to result properties
      console.log(`Session ${result.sessionId} - Approved: ${result.approved}`);
      console.log(`Audit reference: ${result.auditRef}`);
      console.log(`Completed at: ${result.timestamp}`);

      // Process each check with type safety
      result.checks.forEach(check => {
        switch (check.type) {
          case 'age_over':
            console.log(`Age verification (${check.value}+): ${check.passed ? '✅' : '❌'}`);
            break;
          case 'residency_eu':
            console.log(`EU residency: ${check.passed ? '✅' : '❌'}`);
            break;
          case 'identity_verified':
            console.log(`Identity verified: ${check.passed ? '✅' : '❌'}`);
            break;
          default:
            console.log(`${check.type}: ${check.passed ? '✅' : '❌'}`);
        }
      });

      return result;
    } catch (error) {
      console.error('Failed to get verification result:', error);
      throw error;
    }
  }

  /**
   * Poll for verification completion with exponential backoff
   */
  async waitForVerification(
    sessionId: string,
    maxWaitTimeMs: number = 300000, // 5 minutes
    initialDelayMs: number = 1000
  ): Promise<VerificationResult> {
    const startTime = Date.now();
    let delay = initialDelayMs;

    while (Date.now() - startTime < maxWaitTimeMs) {
      try {
        const result = await this.getVerificationResult(sessionId);
        return result; // If we get here, verification is complete
      } catch (error: any) {
        if (error.message?.includes('pending') || error.response?.status === 404) {
          // Still pending, wait before retrying
          console.log(`Waiting ${delay}ms before checking again...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * 1.5, 30000); // Cap at 30 seconds
          continue;
        }

        // Other error, re-throw
        throw error;
      }
    }

    throw new Error(`Verification timeout after ${maxWaitTimeMs}ms`);
  }
}

// Example usage
async function main() {
  const verificationService = new VerificationService();

  try {
    // Start age verification
    const session = await verificationService.startAgeVerification(21, 'user-456');

    // Wait for completion
    console.log('Waiting for user to complete verification...');
    const result = await verificationService.waitForVerification(session.id);

    if (result.approved) {
      console.log('🎉 Verification successful!');
    } else {
      console.log('❌ Verification failed');
    }

  } catch (error) {
    console.error('Verification process failed:', error);
  }
}

// Type-safe webhook payload interface
interface WebhookPayload {
  event: string;
  sessionId: string;
  merchantId: string;
  data: {
    approved?: boolean;
    checks?: Array<{
      type: string;
      passed: boolean;
      value?: number | string;
    }>;
    sessionId?: string;
    auditRef?: string;
  };
  timestamp: string;
}

// Export everything for use in other files
export {
  VerificationService,
  WebhookPayload,
  main
};

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}