/* SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2025 WalletGate
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WalletGate } from '../index';

// Mock Node crypto for webhook tests
const mockNodeCrypto = {
  createHmac: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnValue({
      digest: vi.fn().mockReturnValue('mock_signature')
    })
  }),
  timingSafeEqual: vi.fn().mockReturnValue(true)
};

// Mock Buffer for Node environment simulation
global.Buffer = {
  from: vi.fn().mockImplementation((input) => ({
    length: input?.toString()?.length || 10,
    toString: () => input?.toString() || 'mock_buffer'
  })),
} as any;

// Mock process for Node environment detection
const originalProcess = global.process;

describe('WalletGate Comprehensive Tests', () => {
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    global.process = { versions: { node: '18.0.0' } } as any;
    (globalThis as any).__WG_NODE_CRYPTO = mockNodeCrypto;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.process = originalProcess;
    delete (globalThis as any).__WG_NODE_CRYPTO;
  });

  describe('Configuration and Constructor', () => {
    it('should use default configuration values', () => {
      const client = new WalletGate({ apiKey: 'test-key' });
      expect(client).toBeDefined();
    });

    it('should handle custom retry configuration', () => {
      const client = new WalletGate({
        apiKey: 'test-key',
        retries: {
          maxRetries: 5,
          baseDelayMs: 500,
          factor: 1.5,
          jitter: false
        }
      });
      expect(client).toBeDefined();
    });

    it('should handle rate limit callback', () => {
      const rateLimitCallback = vi.fn();
      const client = new WalletGate({
        apiKey: 'test-key',
        onRateLimit: rateLimitCallback
      });
      expect(client).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limit errors with callback', async () => {
      const rateLimitCallback = vi.fn();
      const client = new WalletGate({
        apiKey: 'test-key',
        baseUrl: 'https://api.test.com',
        onRateLimit: rateLimitCallback
      });

      const mockResponse = {
        ok: false,
        status: 429,
        json: vi.fn().mockResolvedValue({
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded',
          retryAfterSeconds: 60,
          monthlyLimit: 10000,
          dailyLimit: 1000,
          upgradeUrl: 'https://upgrade.example.com'
        })
      };

      fetchSpy.mockResolvedValue(mockResponse);

      await expect(client.startVerification({
        checks: [{ type: 'age_over', value: 18 }]
      })).rejects.toThrow('Rate limit exceeded');

      expect(rateLimitCallback).toHaveBeenCalledWith({
        message: 'Rate limit exceeded',
        retryAfterSeconds: 60,
        monthlyLimit: 10000,
        dailyLimit: 1000,
        upgradeUrl: 'https://upgrade.example.com'
      });
    });

    it('should handle rate limit without optional fields', async () => {
      const rateLimitCallback = vi.fn();
      const client = new WalletGate({
        apiKey: 'test-key',
        onRateLimit: rateLimitCallback
      });

      fetchSpy.mockResolvedValue({
        ok: false,
        status: 429,
        json: vi.fn().mockResolvedValue({
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Basic rate limit'
        })
      });

      await expect(client.startVerification({
        checks: [{ type: 'age_over', value: 18 }]
      })).rejects.toThrow('Rate limit exceeded');

      expect(rateLimitCallback).toHaveBeenCalledWith({
        message: 'Basic rate limit',
        retryAfterSeconds: undefined,
        monthlyLimit: undefined,
        dailyLimit: undefined,
        upgradeUrl: undefined
      });
    });

    it('should handle rate limit callback errors gracefully', async () => {
      const rateLimitCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });

      const client = new WalletGate({
        apiKey: 'test-key',
        onRateLimit: rateLimitCallback
      });

      fetchSpy.mockResolvedValue({
        ok: false,
        status: 429,
        json: vi.fn().mockResolvedValue({
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded'
        })
      });

      await expect(client.startVerification({
        checks: [{ type: 'age_over', value: 18 }]
      })).rejects.toThrow('Rate limit exceeded');

      expect(rateLimitCallback).toHaveBeenCalled();
    });
  });

  describe('Server Error Handling', () => {
    it('should handle 5xx errors with retry', async () => {
      const client = new WalletGate({
        apiKey: 'test-key',
        retries: { maxRetries: 2, baseDelayMs: 10, jitter: false }
      });

      fetchSpy
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: vi.fn().mockResolvedValue({ message: 'Internal server error' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ id: 'sess_123', status: 'pending' })
        });

      const result = await client.startVerification({
        checks: [{ type: 'age_over', value: 18 }]
      });

      expect(result.id).toBe('sess_123');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should exhaust retries for server errors', async () => {
      const client = new WalletGate({
        apiKey: 'test-key',
        retries: { maxRetries: 1, baseDelayMs: 10, jitter: false }
      });

      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({ message: 'Server error' })
      });

      await expect(client.startVerification({
        checks: [{ type: 'age_over', value: 18 }]
      })).rejects.toThrow('Server error');

      expect(fetchSpy).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });

  describe('Webhook Verification Error Cases', () => {
    it('should throw error in browser environment', () => {
      global.process = undefined as any;
      const client = new WalletGate({ apiKey: 'test-key' });

      expect(() => client.verifyWebhook(
        '{"event":"test"}',
        'signature',
        'secret',
        Date.now().toString()
      )).toThrow('verifyWebhook is only supported in Node environments');
    });

    it('should throw error when Node crypto is not available', () => {
      delete (globalThis as any).__WG_NODE_CRYPTO;
      const client = new WalletGate({ apiKey: 'test-key' });

      expect(() => client.verifyWebhook(
        '{"event":"test"}',
        'signature',
        'secret',
        Date.now().toString()
      )).toThrow('Node crypto module not available');
    });
  });

  describe('Request Error Handling', () => {
    it('should handle network errors', async () => {
      const client = new WalletGate({ apiKey: 'test-key' });
      fetchSpy.mockRejectedValue(new Error('Network error'));

      await expect(client.startVerification({
        checks: [{ type: 'age_over', value: 18 }]
      })).rejects.toThrow('Network error');
    });

    it('should handle JSON parsing errors', async () => {
      const client = new WalletGate({ apiKey: 'test-key' });
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      });

      const result = await client.startVerification({
        checks: [{ type: 'age_over', value: 18 }]
      });

      // Should return null when JSON parsing fails
      expect(result).toBeNull();
    });

    it('should handle non-JSON error responses', async () => {
      const client = new WalletGate({ apiKey: 'test-key' });
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        json: vi.fn().mockRejectedValue(new Error('Not JSON'))
      });

      await expect(client.startVerification({
        checks: [{ type: 'age_over', value: 18 }]
      })).rejects.toThrow('Request failed with status 400');
    });
  });

  describe('API Methods Coverage', () => {
    it('should call getResult with correct URL', async () => {
      const client = new WalletGate({
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com'
      });

      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          sessionId: 'sess_123',
          approved: true,
          checks: [],
          auditRef: 'audit_123',
          timestamp: new Date()
        })
      });

      await client.getResult('sess_123');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.example.com/v1/verify/sessions/sess_123',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key'
          })
        })
      );
    });

    it('should handle startVerification with all options', async () => {
      const client = new WalletGate({ apiKey: 'test-key' });

      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'sess_123',
          status: 'pending'
        })
      });

      const sessionInput = {
        checks: [
          { type: 'age_over' as const, value: 18 },
          { type: 'residency_eu' as const }
        ],
        redirectUrl: 'https://example.com/success',
        webhookUrl: 'https://example.com/webhook',
        metadata: { userId: '123' },
        enableAI: true
      };

      await client.startVerification(sessionInput);

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/v1/verify/sessions'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(sessionInput)
        })
      );
    });
  });
});