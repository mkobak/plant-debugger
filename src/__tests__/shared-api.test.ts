/// <reference types="jest" />
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  checkRateLimit,
  addRateLimitDelay,
  processFormData,
  convertImagesToBase64,
  validateImages,
  getClientId,
} from '@/lib/api/shared';

describe('shared api helpers', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  it('rate limit allows first 10 requests, then blocks', () => {
    const client = 'test-client-1';
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(client)).toBe(true);
    }
    expect(checkRateLimit(client)).toBe(false);
  });

  it('rate limit resets after window', () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    const client = 'test-client-2';
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(client)).toBe(true);
    }
    expect(checkRateLimit(client)).toBe(false);
    // advance 61 seconds
    jest.setSystemTime(61_000);
    expect(checkRateLimit(client)).toBe(true);
  });

  it('adds delay when frequent', async () => {
    jest.useFakeTimers();
    const client = 'test-client-3';
    // simulate >5 requests
    for (let i = 0; i < 6; i++) checkRateLimit(client);

    const spy = jest.spyOn(global, 'setTimeout');
    const p = addRateLimitDelay(client);
    // run timers
    jest.advanceTimersByTime(2000);
    await p;
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('processFormData extracts images and fields', async () => {
    const fd = new FormData();
    const f1 = new File([new Uint8Array([1, 2, 3])], 'a.jpg', {
      type: 'image/jpeg',
    });
    const f2 = new File([new Uint8Array([4, 5])], 'b.png', {
      type: 'image/png',
    });
    fd.append('images[0]', f1);
    fd.append('images[1]', f2);
    fd.append('questionsAndAnswers', 'qa');
    fd.append('rankedDiagnoses', 'rd');
    const res = await processFormData(fd);
    expect(res.images).toHaveLength(2);
    expect(res.questionsAndAnswers).toBe('qa');
    expect(res.rankedDiagnoses).toBe('rd');
  });

  it('convertImagesToBase64 returns inlineData', async () => {
    const bytes = new Uint8Array([104, 101, 108, 108, 111]); // 'hello'
    const f = new File([bytes], 't.txt', { type: 'text/plain' });
    if (!('arrayBuffer' in f)) {
      (f as any).arrayBuffer = async () => bytes.buffer;
    }
    const out = await convertImagesToBase64([f]);
    expect(out[0].inlineData.mimeType).toBe('text/plain');
    expect(typeof out[0].inlineData.data).toBe('string');
    expect(out[0].inlineData.data.length).toBeGreaterThan(0);
  });

  it('validateImages throws on empty', () => {
    expect(() => validateImages([] as unknown as File[])).toThrow(
      'No images provided'
    );
  });

  it('getClientId prefers x-pb-client-id then x-forwarded-for then x-real-ip', () => {
    const makeReq = (headers: Record<string, string>) =>
      ({ headers: { get: (k: string) => headers[k] || null } }) as any;
    expect(getClientId(makeReq({ 'x-pb-client-id': 'cid' }))).toBe('cid');
    expect(getClientId(makeReq({ 'x-forwarded-for': 'xff' }))).toBe('xff');
    expect(getClientId(makeReq({ 'x-real-ip': 'xri' }))).toBe('xri');
    expect(getClientId(makeReq({}))).toBe('::1');
  });
});
