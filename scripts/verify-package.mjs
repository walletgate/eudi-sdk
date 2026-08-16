#!/usr/bin/env node
/**
 * Packs the SDK exactly as npm would publish it, installs the tarball into a
 * throwaway project, and proves a consumer can actually use it.
 *
 * v2.1.0 shipped unusable: package.json declared "type": "module" while esbuild
 * emitted a CommonJS bundle for node and a bare IIFE for the browser, so
 * `import { WalletGate } from '@walletgate/eudi'` threw "does not provide an
 * export named 'WalletGate'" and `require(...)` threw "module is not defined in
 * ES module scope". Nothing in the build, the typecheck or the unit tests looks
 * at the packed artifact, so all of them stayed green.
 *
 * Runs as part of prepublishOnly. Node built-ins only, no extra dependencies.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'));

const failures = [];
const check = (name, fn) => {
  try {
    fn();
    console.log(`  ok    ${name}`);
  } catch (err) {
    failures.push(name);
    console.log(`  FAIL  ${name}`);
    console.log(
      String(err.stdout || err.stderr || err.message)
        .trim()
        .split('\n')
        .slice(0, 6)
        .map((l) => `          ${l}`)
        .join('\n'),
    );
  }
};

const work = mkdtempSync(join(tmpdir(), 'walletgate-pkg-'));
const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

try {
  console.log(`verifying ${pkg.name}@${pkg.version} as a consumer would install it`);

  // 1. Pack exactly what publish would upload.
  const packOut = run('npm', ['pack', '--pack-destination', work], pkgRoot);
  const tarball = join(work, packOut.trim().split('\n').pop().trim());

  // 2. Install it into a clean project.
  const consumer = join(work, 'consumer');
  run('mkdir', ['-p', consumer], work);
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({ name: 'consumer', version: '1.0.0', private: true }, null, 2),
  );
  run('npm', ['install', tarball, '--no-audit', '--no-fund', '--silent'], consumer);

  const installed = join(consumer, 'node_modules', pkg.name.replace('/', '/'));

  // 3. The two ways every documented snippet reaches the SDK.
  check('ESM: import { WalletGate } from the package name', () => {
    writeFileSync(
      join(consumer, 'esm-check.mjs'),
      `import { WalletGate, WalletGateApiError } from '${pkg.name}';\n` +
        `if (typeof WalletGate !== 'function') throw new Error('WalletGate is ' + typeof WalletGate);\n` +
        `if (typeof WalletGateApiError !== 'function') throw new Error('WalletGateApiError missing');\n` +
        `new WalletGate({ apiKey: 'wg_test_x', baseUrl: 'https://example.invalid' });\n`,
    );
    run('node', ['esm-check.mjs'], consumer);
  });

  check('CJS: require() the package name', () => {
    writeFileSync(
      join(consumer, 'cjs-check.cjs'),
      `const { WalletGate } = require('${pkg.name}');\n` +
        `if (typeof WalletGate !== 'function') throw new Error('WalletGate is ' + typeof WalletGate);\n` +
        `new WalletGate({ apiKey: 'wg_test_x', baseUrl: 'https://example.invalid' });\n`,
    );
    run('node', ['cjs-check.cjs'], consumer);
  });

  // 4. The browser bundle must actually export something. An IIFE parses fine
  //    and resolves fine, and then every named import from it is undefined.
  check('browser bundle exposes ES module exports', () => {
    const browserEntry = join(installed, 'dist', 'browser', 'index.js');
    if (!existsSync(browserEntry)) throw new Error(`missing ${browserEntry}`);
    const src = readFileSync(browserEntry, 'utf8');
    if (!/\bexport\s*\{/.test(src) && !/\bexport\s+(const|class|function)\b/.test(src)) {
      throw new Error('no export statement found — bundle is not an ES module');
    }
    if (!/WalletGate/.test(src)) throw new Error('WalletGate not present in browser bundle');
  });

  // 5. Types must resolve to a real declaration file.
  check('types entry exists and declares WalletGate', () => {
    const typesEntry = join(installed, pkg.types);
    if (!existsSync(typesEntry)) throw new Error(`missing ${typesEntry}`);
    if (!/WalletGate/.test(readFileSync(typesEntry, 'utf8'))) {
      throw new Error('WalletGate absent from type declarations');
    }
  });

  // 6. Every path named in package.json must be inside the tarball.
  check('main / module / types / bin all exist in the tarball', () => {
    const entries = [pkg.main, pkg.module, pkg.types, ...Object.values(pkg.bin || {})];
    const missing = entries.filter((rel) => rel && !existsSync(join(installed, rel)));
    if (missing.length) throw new Error(`declared but not shipped: ${missing.join(', ')}`);
  });

  check('CLI entry runs', () => {
    run('node', [join(installed, pkg.bin.walletgate), '--help'], consumer);
  });
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\npackage verification failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\npackage verification passed');
