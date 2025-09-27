# @walletgate/eudi

[![CI](https://github.com/walletgate/eudi-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/walletgate/eudi-sdk/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/%40walletgate%2Feudi.svg)](https://badge.fury.io/js/%40walletgate%2Feudi)
[![npm downloads](https://img.shields.io/npm/dm/@walletgate/eudi.svg)](https://www.npmjs.com/package/@walletgate/eudi)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![EUDI Compliant](https://img.shields.io/badge/EUDI-Compliant-green.svg)](https://eu-digital-identity-wallet.github.io/Build/)

> **EU Digital Identity Wallet verification made simple**

WalletGate is a **Verifier/Relying Party** solution in the [EU Digital Identity Wallet ecosystem](https://eu-digital-identity-wallet.github.io/Build/). We enable businesses to accept and verify electronic attestations from EUDI Wallets using real EU government infrastructure.

## 🌟 Open Source

**WalletGate EUDI SDK is proudly open source** under Apache-2.0. We believe in transparent, community-driven identity verification infrastructure.

- ✅ **Core SDK**: Always free and open source
- 🏢 **Enterprise features**: Advanced analytics, SLA support, on-premise deployment
- 🤝 **Community first**: Contributions welcome, roadmap driven by real needs
- 🔒 **Trust through transparency**: Inspect our code, verify our claims

[View source on GitHub](https://github.com/walletgate/eudi-sdk) • [Contribute](https://github.com/walletgate/eudi-sdk/blob/main/CONTRIBUTING.md) • [Enterprise features](https://walletgate.app/enterprise)

## Features

- **🏛️ Real EU Infrastructure**: Direct connection to [EU LOTL](https://ec.europa.eu/tools/lotl/eu-lotl.xml) (List of Trusted Lists)
- **📋 Standards Compliant**: OpenID4VP, ISO 18013-5, SD-JWT VC, mDoc
- **🔐 Production Ready**: Government trust chains, not test certificates
- **🚀 Simple Integration**: 5 lines of code instead of 500+

## Installation

### Node.js / JavaScript / TypeScript

```bash
npm install @walletgate/eudi
```

Or try the CLI quick links (no install):

```bash
npx @walletgate/eudi walletgate help
# Prints: Get a free test API key + Docs links
```

### Other Languages

For **Ruby, PHP, Java, Python, Go**, and other languages, use our HTTP API directly:

- 📖 **[Complete HTTP API Guide](./docs/HTTP_API.md)** - Production-ready examples with error handling
- 🔗 **Direct API calls** - No SDK installation required
- ✅ **All languages supported** - Same functionality as JavaScript SDK

**Quick Example (any language):**
```bash
curl -X POST https://api.walletgate.app/v1/verify/sessions \
  -H "Authorization: Bearer your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"checks":[{"type":"age_over","value":18}]}'
```

## Quick Start

**Before you begin**: WalletGate supports two environments for development and production:

- **🧪 Test Environment**: Get a free test API key (`wg_test_*`) at https://walletgate.app/signup — mock TSL for safe development with a 100 verifications/month cap per merchant
- **🚀 Live Environment**: Upgrade to a paid plan for live API keys (`wg_live_*`) — real EU LOTL verification with plan-based usage quotas

### 1. Initialize

```typescript
import { WalletGate } from '@walletgate/eudi';

const eudi = new WalletGate({
  apiKey: process.env.WALLETGATE_API_KEY, // wg_test_* or wg_live_*
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
window.location.href = session.verificationUrl;

// Or show QR code for cross-device (generate locally; no external services)
import { makeQrDataUrl } from '@walletgate/eudi';
const qrCode = await makeQrDataUrl(session.verificationUrl);
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

## Environment Handling

WalletGate automatically detects your environment based on your API key:

```typescript
const session = await eudi.startVerification({
  checks: [{ type: 'age_over', value: 18 }]
});

// Check environment from response
if (session.environment === 'test') {
  console.log('⚠️ Test mode:', session.warning);
  // "THIS IS A TEST VERIFICATION - NOT A REAL CREDENTIAL CHECK"
} else {
  console.log('✅ Live environment - real verification');
}
```

### Test Environment
- **API Keys**: `wg_test_*`
- **Purpose**: Development and testing
- **Features**: Mock TSL, no usage limits, test warnings
- **Cost**: Free for all users

### Live Environment
- **API Keys**: `wg_live_*`
- **Purpose**: Production verification
- **Features**: Real EU LOTL, usage quotas, SLAs
- **Cost**: Paid plans only

## Handling Rate Limits

Live environment keys have usage quotas. The SDK surfaces 429 details and lets you hook a callback:

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

**Note**: Test environment API keys have no rate limits or quotas.

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
    const { verificationUrl } = await res.json();
    window.location.href = verificationUrl;
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
    walletUrl: session.verificationUrl
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
  verificationUrl: string;
  status: 'pending';
  environment: 'test' | 'live';
  testMode?: boolean;
  warning?: string;
  createdAt: string;
}

interface VerificationResult {
  id: string;
  status: 'pending' | 'verified' | 'failed' | 'expired';
  environment: 'test' | 'live';
  testMode?: boolean;
  warning?: string;
  checks: Record<string, boolean>;
  reason?: string;
  completedAt?: string;
}
```

## Testing

WalletGate provides a comprehensive test environment for safe development:

1. **Get test API key**: https://walletgate.app/signup (free, 100 verifications/month cap per merchant)
2. **Use test wallet**: https://test-wallet.walletgate.app
3. **Mock TSL verification**: Uses fake certificates for safe testing
4. **Test personas**: Adult/minor, EU/non-EU resident options
5. **Usage**: Test requests don't count towards live plan quotas, but are subject to the 100/month test cap

```typescript
// Test environment automatically detected from API key prefix
const testEudi = new WalletGate({
  apiKey: 'wg_test_your_key_here' // Auto-detected as test environment
});

const session = await testEudi.startVerification({
  checks: [{ type: 'age_over', value: 18 }]
});

console.log(session.environment); // "test"
console.log(session.testMode);    // true
console.log(session.warning);     // "THIS IS A TEST VERIFICATION..."
```

## Technical Details

### Standards & Compliance
- **OpenID4VP 1.0**: Verifiable presentation protocol
- **ISO 18013-5**: Mobile driver's license standard
- **eIDAS 2.0**: EU Digital Identity regulation
- **EU LOTL**: Real government trust lists
- **GDPR**: Privacy-first, data minimization

### Security
- Certificate chain validation to EU roots
- OCSP/CRL revocation checking (planned; disabled in MVP)
- HMAC-SHA256 webhook signatures
- Complete audit trails

## Plans & Limits

- **Trial (Test)**: 100 verifications/month (per merchant)
- **Starter (Live)**: 1,000 verifications/month
- **Growth (Live)**: 10,000 verifications/month
- **Scale (Live)**: 50,000 verifications/month

Daily rolling 24h caps are configurable by environment variables on the server (disabled by default).

## Links

- **Documentation**: https://walletgate.app/docs
- **Dashboard**: https://app.walletgate.app
- **GitHub (SDK)**: https://github.com/walletgate/eudi-sdk
- **GitHub (Company)**: https://github.com/walletgate
- **LinkedIn**: https://www.linkedin.com/company/walletgate
- **Support**: support@walletgate.app

## License

Apache-2.0 - See [LICENSE](LICENSE) for details.
