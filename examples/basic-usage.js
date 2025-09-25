/**
 * Basic usage example of the WalletGate EUDI SDK
 *
 * This example shows how to:
 * 1. Initialize the WalletGate client
 * 2. Start a verification session
 * 3. Poll for the result
 */

import { WalletGate } from '@walletgate/eudi';

async function basicVerification() {
  // Initialize the client
  const client = new WalletGate({
    apiKey: process.env.WALLETGATE_API_KEY || 'your-api-key',
    baseUrl: process.env.WALLETGATE_BASE_URL || 'https://api.walletgate.app',
    timeout: 30000, // 30 seconds
    retries: {
      maxRetries: 3,
      baseDelayMs: 1000,
    }
  });

  try {
    // Start verification session
    console.log('Starting verification session...');
    const session = await client.startVerification({
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

    // Poll for result (in real app, you'd use webhooks instead)
    console.log('Polling for result...');
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes with 10s intervals

    while (attempts < maxAttempts) {
      try {
        const result = await client.getResult(session.id);

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
      } catch (error) {
        if (error.message.includes('pending')) {
          console.log(`Attempt ${attempts + 1}: Still pending...`);
          await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
          attempts++;
          continue;
        }
        throw error;
      }
    }

    if (attempts >= maxAttempts) {
      console.log('⏱️ Verification timed out');
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  basicVerification().catch(console.error);
}

export { basicVerification };