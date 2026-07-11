/// <reference types="jest" />
import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  checkRateLimit,
  getClientIp,
  resetRateLimit,
} from '@/lib/api/rateLimit';

describe('checkRateLimit', () => {
  beforeEach(() => resetRateLimit());

  it('allows first 20 requests in a window, then blocks', () => {
    const now = 1_000_000;
    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit('ip-1', now)).toBe(true);
    }
    expect(checkRateLimit('ip-1', now)).toBe(false);
  });

  it('resets after the window passes', () => {
    const now = 1_000_000;
    for (let i = 0; i < 21; i++) checkRateLimit('ip-2', now);
    expect(checkRateLimit('ip-2', now)).toBe(false);
    expect(checkRateLimit('ip-2', now + 61_000)).toBe(true);
  });

  it('tracks clients independently', () => {
    const now = 1_000_000;
    for (let i = 0; i < 21; i++) checkRateLimit('ip-3', now);
    expect(checkRateLimit('ip-3', now)).toBe(false);
    expect(checkRateLimit('ip-4', now)).toBe(true);
  });

  it('bounds memory: evicts entries rather than growing forever', () => {
    const now = 1_000_000;
    // fill way past the cap with distinct keys (attacker-controlled keys)
    for (let i = 0; i < 5000; i++) {
      checkRateLimit(`attacker-${i}`, now);
    }
    // a fresh legitimate client must still be admitted
    expect(checkRateLimit('legit', now)).toBe(true);
  });
});

describe('getClientIp', () => {
  const makeReq = (headers: Record<string, string>) =>
    ({ headers: { get: (k: string) => headers[k] || null } }) as any;

  it('never uses the client-supplied x-pb-client-id header', () => {
    expect(
      getClientIp(
        makeReq({ 'x-pb-client-id': 'spoofed', 'x-real-ip': '9.9.9.9' })
      )
    ).toBe('9.9.9.9');
  });

  it('prefers x-vercel-forwarded-for, then x-forwarded-for first hop, then x-real-ip', () => {
    expect(
      getClientIp(
        makeReq({
          'x-vercel-forwarded-for': '1.1.1.1',
          'x-forwarded-for': '2.2.2.2',
        })
      )
    ).toBe('1.1.1.1');
    expect(
      getClientIp(makeReq({ 'x-forwarded-for': '3.3.3.3, 10.0.0.1' }))
    ).toBe('3.3.3.3');
    expect(getClientIp(makeReq({ 'x-real-ip': '4.4.4.4' }))).toBe('4.4.4.4');
    expect(getClientIp(makeReq({}))).toBe('local');
  });
});
