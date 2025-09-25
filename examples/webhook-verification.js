/**
 * Webhook verification example
 *
 * This example shows how to verify webhook signatures
 * to ensure webhook payloads are authentic.
 */

import { WalletGate } from '@walletgate/eudi';
import crypto from 'crypto';

// Mock Node.js crypto for webhook verification
// In a real Node.js environment, this would be the actual crypto module
global.__WG_NODE_CRYPTO = crypto;

const client = new WalletGate({
  apiKey: process.env.WALLETGATE_API_KEY || 'your-api-key',
  baseUrl: process.env.WALLETGATE_BASE_URL || 'https://api.walletgate.app'
});

/**
 * Verify a webhook payload
 */
function verifyWebhook(req) {
  const signature = req.headers['x-walletgate-signature'];
  const timestamp = req.headers['x-walletgate-timestamp'];
  const rawBody = JSON.stringify(req.body);
  const webhookSecret = process.env.WEBHOOK_SECRET;

  if (!signature || !timestamp || !webhookSecret) {
    console.error('Missing required headers or webhook secret');
    return false;
  }

  try {
    const isValid = client.verifyWebhook(rawBody, signature, webhookSecret, timestamp);

    if (isValid) {
      console.log('✅ Webhook signature verified');
      return true;
    } else {
      console.log('❌ Invalid webhook signature');
      return false;
    }
  } catch (error) {
    console.error('Error verifying webhook:', error.message);
    return false;
  }
}

/**
 * Handle webhook payload
 */
function handleWebhook(payload) {
  console.log('Processing webhook event:', payload.event);
  console.log('Session ID:', payload.sessionId);
  console.log('Merchant ID:', payload.merchantId);

  switch (payload.event) {
    case 'verification.completed':
      console.log('🎉 Verification completed');
      if (payload.data.approved) {
        console.log('✅ User verified successfully');
        // Handle successful verification
        updateUserStatus(payload.data.sessionId, 'verified');
      } else {
        console.log('❌ User verification failed');
        // Handle failed verification
        updateUserStatus(payload.data.sessionId, 'failed');
      }
      break;

    case 'verification.expired':
      console.log('⏱️ Verification session expired');
      updateUserStatus(payload.data.sessionId, 'expired');
      break;

    case 'verification.failed':
      console.log('💥 Verification session failed');
      updateUserStatus(payload.data.sessionId, 'failed');
      break;

    default:
      console.log('Unknown event type:', payload.event);
  }
}

/**
 * Mock function to update user status
 */
function updateUserStatus(sessionId, status) {
  console.log(`Updating user status for session ${sessionId} to: ${status}`);
  // In a real app, you'd update your database here
}

/**
 * Express.js webhook endpoint example
 */
function webhookEndpoint(req, res) {
  // Verify the webhook signature
  if (!verifyWebhook(req)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Process the webhook
  try {
    handleWebhook(req.body);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Example usage with Express.js
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Webhook verification example');

  // Mock webhook payload for testing
  const mockPayload = {
    event: 'verification.completed',
    sessionId: 'sess_123456789',
    merchantId: 'merchant_123',
    data: {
      approved: true,
      checks: [
        { type: 'age_over', value: 18, passed: true },
        { type: 'residency_eu', passed: true }
      ]
    },
    timestamp: new Date().toISOString()
  };

  // Mock request object
  const mockReq = {
    headers: {
      'x-walletgate-signature': 'mock_signature',
      'x-walletgate-timestamp': Date.now().toString()
    },
    body: mockPayload
  };

  console.log('Testing webhook verification...');
  handleWebhook(mockPayload);
}

export {
  verifyWebhook,
  handleWebhook,
  webhookEndpoint
};