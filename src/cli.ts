/* SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2025 WalletGate
 */

/* eslint-disable no-console */

const SIGNUP_URL = 'https://walletgate.app/signup';
const DOCS_URL = 'https://walletgate.app/docs';

function main(): void {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'help';
  if (cmd === 'help') {
    console.log('\nWalletGate – EU Digital Identity SDK');
    console.log('----------------------------------');
    console.log(`Get a free test API key: ${SIGNUP_URL}`);
    console.log(`Read the docs:           ${DOCS_URL}`);
    console.log('\nUsage:');
    console.log('  walletgate help        Show this message');
    console.log('');
    process.exit(0);
  }
  console.log('Unknown command. Try: walletgate help');
}

main();
