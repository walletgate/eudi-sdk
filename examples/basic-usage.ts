/**
 * Basic usage example of the WalletGate EUDI SDK
 *
 * This example shows how to:
 * 1. Initialize the WalletGate client
 * 2. Start a verification session
 * 3. Poll for the result
 */

import { WalletGate, VerificationSession, VerificationResult } from '@walletgate/eudi';

async function basicVerification(): Promise<void> {
  const client = new WalletGate({
    apiKey: process.env.WALLETGATE_API_KEY || 'your-api-key',
    timeout: 30000,
    retries: {
      maxRetries: 3,
      baseDelayMs: 1000,
    }
  });

  try {
    console.log('Starting verification session...');
    const session: VerificationSession = await client.startVerification({
      checks: [
        { type: 'age_over', value: 18 },
        { type: 'residency_eu' }
      ],
      redirectUrl: 'https://yourapp.com/success',
      webhookUrl: 'https://yourapp.com/webhook',
      metadata: {
        userId: 'user-123',
        source: 'web-app'
      }
    });

    console.log(`Session created with ID: ${session.id}`);
    console.log(`Wallet request URL: ${session.walletRequestUrl}`);
    console.log(`Session expires at: ${session.expiresAt}`);

    console.log('Polling for result...');
    let attempts: number = 0;
    const maxAttempts: number = 30;

    while (attempts < maxAttempts) {
      try {
        const result: VerificationResult = await client.getResult(session.id);

        if (result.approved) {
          console.log('✅ Verification successful!');
          console.log('Checks passed:');
          result.checks.forEach(check => {
            console.log(`  - ${check.type}: ${check.passed ? '✅' : '❌'}`);
          });
          console.log(`Audit reference: ${result.auditRef}`);
          break;
        } else {
          console.log('❌ Verification failed');
          console.log('Check results:');
          result.checks.forEach(check => {
            console.log(`  - ${check.type}: ${check.passed ? '✅' : '❌'}`);
          });
          break;
        }
      } catch (error: any) {
        if (error.message?.includes('pending')) {
          console.log(`Attempt ${attempts + 1}: Still pending...`);
          await new Promise(resolve => setTimeout(resolve, 10000));
          attempts++;
          continue;
        }
        throw error;
      }
    }

    if (attempts >= maxAttempts) {
      console.log('⏱️ Verification timed out');
    }

  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  basicVerification().catch(console.error);
}

export { basicVerification };