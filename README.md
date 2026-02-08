# @walletgate/eudi

[![CI](https://github.com/walletgate/eudi-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/walletgate/eudi-sdk/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@walletgate/eudi.svg)](https://www.npmjs.com/package/@walletgate/eudi)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![EUDI Compliant](https://img.shields.io/badge/EUDI-Compliant-green.svg)](https://eu-digital-identity-wallet.github.io/Build/)

> EU Digital Identity Wallet verification made simple.

WalletGate is a Verifier/Relying Party SDK for the EU Digital Identity Wallet ecosystem. It lets you create verification sessions, direct users to their wallet, and fetch signed results using real EU trust infrastructure.

## Installation

::: code-group

```bash [npm]
npm install @walletgate/eudi
```

```bash [pnpm]
pnpm add @walletgate/eudi
```

```bash [yarn]
yarn add @walletgate/eudi
```

:::

Optional CLI (no install):

```bash
npx @walletgate/eudi walletgate help
# Prints: Get a free test API key + Docs links
```

## Quick Start

WalletGate supports two environments:
- Test keys: `wg_test_*`
- Live keys: `wg_live_*`

### 1. Initialize

```ts
import { WalletGate } from '@walletgate/eudi';

const eudi = new WalletGate({
  apiKey: process.env.WALLETGATE_API_KEY,
  baseUrl: 'https://api.walletgate.app'
});
```

### 2. Start Verification

```ts
const session = await eudi.startVerification({
  checks: [
    { type: 'age_over', value: 18 },
    { type: 'residency_eu' }
  ],
  redirectUrl: 'https://yourapp.com/verify-complete'
});

// Redirect user to wallet
window.location.href = session.verificationUrl;
```

### 3. Get Results

```ts
const result = await eudi.getResult(session.id);

if (result.status === 'completed') {
  console.log('Age over 18:', result.results?.age_over_18);
  console.log('EU resident:', result.results?.residency_eu);
}
```

## QR Code Helper (Optional)

If you want to show a QR code for cross-device flows, install the optional `qrcode` dependency:

```bash
npm install qrcode
```

Then generate a data URL locally (no external services):

```ts
import { makeQrDataUrl } from '@walletgate/eudi';
const qrCode = await makeQrDataUrl(session.verificationUrl);
```

## Webhook Verification (Node)

```ts
import * as crypto from 'crypto';

// Required for verifyWebhook in Node environments
(globalThis as any).__WG_NODE_CRYPTO = crypto;

app.post('/webhooks/walletgate', (req, res) => {
  const signature = req.headers['wg-signature'];
  const timestamp = req.headers['wg-timestamp'];

  const isValid = eudi.verifyWebhook(
    req.rawBody,
    signature,
    process.env.WEBHOOK_SECRET,
    timestamp
  );

  if (!isValid) return res.status(400).send('Invalid signature');
  res.sendStatus(200);
});
```

## REST API (Other Languages)

Use the REST API directly in any language:

::: code-group

```bash [cURL]
curl -X POST https://api.walletgate.app/v1/verify/sessions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"checks":[{"type":"age_over","value":18}]}'
```

```python [Python]
import requests, os

response = requests.post(
    'https://api.walletgate.app/v1/verify/sessions',
    headers={'Authorization': f'Bearer {os.getenv("WALLETGATE_API_KEY")}'},
    json={'checks': [{'type': 'age_over', 'value': 18}]}
)
print(response.json())
```

:::

## API Reference (Short)

- `new WalletGate(config)`
- `startVerification(input)`
- `getResult(sessionId)`
- `verifyWebhook(rawBody, signature, secret, timestamp)`
- `makeQrDataUrl(url)`

See the docs for full reference, error handling, and examples.

## Links

- Docs: https://docs.walletgate.app/
- Get early access: https://walletgate.app
- Discord: https://discord.gg/KZ8sP5Ua
- Support: support@walletgate.app
- Security: security@walletgate.app
- Repo: https://github.com/walletgate/eudi-sdk

## License

Apache-2.0 - See [LICENSE](LICENSE).
