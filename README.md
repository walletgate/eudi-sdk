# @walletgate/eudi

[![npm version](https://badge.fury.io/js/%40walletgate%2Feudi.svg)](https://badge.fury.io/js/%40walletgate%2Feudi)
[![npm downloads](https://img.shields.io/npm/dm/@walletgate/eudi.svg)](https://www.npmjs.com/package/@walletgate/eudi)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![EUDI Compliant](https://img.shields.io/badge/EUDI-Compliant-green.svg)](https://eu-digital-identity-wallet.github.io/Build/)

> **EU Digital Identity Wallet verification made simple**

WalletGate is a **Verifier/Relying Party** solution in the [EU Digital Identity Wallet ecosystem](https://eu-digital-identity-wallet.github.io/Build/). We enable businesses to accept and verify electronic attestations from EUDI Wallets using real EU government infrastructure.

## Features

- **🏛️ Real EU Infrastructure**: Direct connection to [EU LOTL](https://ec.europa.eu/tools/lotl/eu-lotl.xml) (List of Trusted Lists)
- **📋 Standards Compliant**: OpenID4VP, ISO 18013-5, SD-JWT VC, mDoc
- **🔐 Production Ready**: Government trust chains, not test certificates
- **🚀 Simple Integration**: 5 lines of code instead of 500+

## Installation

```bash
npm install @walletgate/eudi
```

Or try the CLI quick links (no install):

```bash
npx @walletgate/eudi walletgate help
# Prints: Get a free test API key + Docs links
```

## Quick Start

Before you begin: Get a free, rate‑limited test API key at https://walletgate.app/signup (Starter: 60 req/min per key, 1,000 verifications/month in test). Upgrade anytime for higher limits and live access.

### 1. Initialize

```typescript
import { WalletGate } from '@walletgate/eudi';

const eudi = new WalletGate({
  apiKey: process.env.WALLETGATE_API_KEY, // Get from https://walletgate.app/signup
  baseUrl: 'https://api.walletgate.app'
});
```

### 2. Start Verification

```typescript
const session = await eudi.startVerification({
  checks: [
    { type: 'age_over', value: 18 },
    { type: 'residency_in', value: ['EU'] }
  ],
  redirectUrl: 'https://yourapp.com/verify-complete'
});

// Redirect user to wallet
window.location.href = session.walletRequestUrl;

// Or show QR code for cross-device
import { makeQrDataUrl } from '@walletgate/eudi';
const qrCode = await makeQrDataUrl(session.walletRequestUrl);
```

### 3. Get Results

```typescript
const result = await eudi.getResult(sessionId);

if (result.status === 'verified') {
  // User successfully verified
  console.log('Age over 18:', result.checks.age_over_18);
  console.log('EU resident:', result.checks.eu_resident);
}
```

## Verification Types

| Type | Description | Example |
|------|-------------|---------|
| `age_over` | Verify minimum age | `{ type: 'age_over', value: 18 }` |
| `age_under` | Verify maximum age | `{ type: 'age_under', value: 65 }` |
| `residency_in` | Verify residency | `{ type: 'residency_in', value: ['DE', 'FR'] }` |
| `name_match` | KYC name matching | `{ type: 'name_match', value: 'John Doe' }` |

## Webhooks

```typescript
app.post('/webhooks/walletgate', (req, res) => {
  const signature = req.headers['wg-signature'];
  const timestamp = req.headers['wg-timestamp'];

  // Verify webhook authenticity
  const isValid = eudi.verifyWebhook(
    req.rawBody,
    signature,
    process.env.WEBHOOK_SECRET,
    timestamp
  );

  if (!isValid) return res.status(400).send('Invalid signature');

  const event = JSON.parse(req.rawBody);

  switch(event.type) {
    case 'verification.completed':
      // Handle successful verification
      break;
    case 'verification.failed':
      // Handle failed verification
      break;
  }

  res.sendStatus(200);
});
```

## Handling Rate Limits

Starter keys are rate‑limited (60 req/min per key) with a monthly quota. The SDK surfaces 429 details and lets you hook a callback:

```ts
const eudi = new WalletGate({
  apiKey: process.env.WALLETGATE_API_KEY!,
  onRateLimit: (info) => {
    // info: { message, retryAfterSeconds?, dailyLimit?, monthlyLimit?, upgradeUrl? }
    console.warn(`Rate limited. ${info.message}. Retry in ~${info.retryAfterSeconds}s.`);
  },
});

try {
  await eudi.startVerification({ checks: [{ type: 'age_over', value: 18 }] });
} catch (err) {
  // err.message includes retryAfterSeconds and upgradeUrl when available
}
```

## Framework Examples

### Next.js

```typescript
// pages/api/verify.ts
export default async function handler(req, res) {
  const eudi = new WalletGate({ apiKey: process.env.WALLETGATE_API_KEY });

  if (req.method === 'POST') {
    const session = await eudi.startVerification({
      checks: [{ type: 'age_over', value: 18 }]
    });
    res.json(session);
  }
}

// components/AgeGate.tsx
export function AgeGate() {
  const verifyAge = async () => {
    const res = await fetch('/api/verify', { method: 'POST' });
    const { walletRequestUrl } = await res.json();
    window.location.href = walletRequestUrl;
  };

  return <button onClick={verifyAge}>Verify Age with EUDI Wallet</button>;
}
```

### Express.js

```typescript
import express from 'express';
import { WalletGate } from '@walletgate/eudi';

const app = express();
const eudi = new WalletGate({ apiKey: process.env.WALLETGATE_API_KEY });

app.post('/verify/start', async (req, res) => {
  const session = await eudi.startVerification({
    checks: req.body.checks,
    redirectUrl: `${req.protocol}://${req.get('host')}/verify/complete`
  });

  res.json({
    sessionId: session.id,
    walletUrl: session.walletRequestUrl
  });
});

app.get('/verify/:sessionId', async (req, res) => {
  const result = await eudi.getResult(req.params.sessionId);
  res.json(result);
});
```

## API Reference

### `new WalletGate(config)`
- `apiKey`: Your WalletGate API key
- `baseUrl`: API endpoint (optional)
- `timeout`: Request timeout in ms (optional)

### `startVerification(input)`
- `checks`: Array of verification requirements
- `redirectUrl`: Post-verification redirect (optional)
- Returns: `VerificationSession`

### `getResult(sessionId)`
- `sessionId`: From `startVerification`
- Returns: `VerificationResult`

### `verifyWebhook(rawBody, signature, secret, timestamp)`
- Verify webhook signatures (Node.js only)
- Returns: `boolean`

Note: For tests and specialized runtimes, you can inject Node's `crypto` as `globalThis.__WG_NODE_CRYPTO`.

### `makeQrDataUrl(url)`
- Generate QR code for cross-device flow
- Returns: `Promise<string>` (data URL)

Optional peer dependency: install `qrcode` for built‑in QR support, or inject a generator via `globalThis.__WG_QR`.

## TypeScript Types

```typescript
interface CheckType {
  type: 'age_over' | 'age_under' | 'residency_in' | 'name_match';
  value: number | string | string[];
}

interface VerificationSession {
  id: string;
  walletRequestUrl: string;
  status: 'pending';
  createdAt: string;
}

interface VerificationResult {
  id: string;
  status: 'pending' | 'verified' | 'failed' | 'expired';
  checks: Record<string, boolean>;
  reason?: string;
  completedAt?: string;
}
```

## Testing

Use our test environment with real EU infrastructure:

1. Get test API key: https://walletgate.app/signup
2. Use test wallet: https://test-wallet.walletgate.app
3. Select test personas (adult/minor, EU/non-EU resident)

## Technical Details

### Standards & Compliance
- **OpenID4VP 1.0**: Verifiable presentation protocol
- **ISO 18013-5**: Mobile driver's license standard
- **eIDAS 2.0**: EU Digital Identity regulation
- **EU LOTL**: Real government trust lists
- **GDPR**: Privacy-first, data minimization

### Security
- Certificate chain validation to EU roots
- Real-time OCSP/CRL revocation checking
- HMAC-SHA256 webhook signatures
- Complete audit trails

## Links

- **Documentation**: https://walletgate.app/docs
- **Dashboard**: https://app.walletgate.app
- **GitHub**: https://github.com/walletgate/eudi-sdk
- **Support**: support@walletgate.app

## License

Apache-2.0 - See [LICENSE](LICENSE) for details.
