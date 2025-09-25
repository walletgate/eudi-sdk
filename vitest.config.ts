/// <reference types="vitest" />
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'dist/',
        '*.config.ts',
        'src/__tests__/**',
        'coverage/**',
        'examples/**',
        '.eslintrc.js',
        'src/cli.ts', // CLI is not core functionality
        'src/types/qrcode.d.ts', // Type definitions
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
      all: true,
    },
  },
});