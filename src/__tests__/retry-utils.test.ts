/// <reference types="jest" />
import { withRetry } from '@/lib/api/retry-utils';

describe('withRetry', () => {
  it('resolves on first attempt', async () => {
    const result = await withRetry(async () => 'ok', 'test-first', {
      maxRetries: 2,
      retryDelay: 0,
    });
    expect(result).toBe('ok');
  });

  it('retries on retryable error and succeeds', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls === 1) {
          throw new Error('500 Internal Server Error');
        }
        return 'ok';
      },
      'test-retry',
      { maxRetries: 2, retryDelay: 0 }
    );

    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });

  it('does not retry non-retryable error', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new Error('400 Bad Request');
        },
        'test-no-retry',
        { maxRetries: 3, retryDelay: 0 }
      )
    ).rejects.toThrow(/failed after 1 attempts|Bad Request/);
    expect(calls).toBe(1);
  });

  it('throws after max attempts', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new Error('500');
        },
        'test-max',
        { maxRetries: 2, retryDelay: 0 }
      )
    ).rejects.toThrow(/failed after 3 attempts/);
    expect(calls).toBe(3);
  });
});
