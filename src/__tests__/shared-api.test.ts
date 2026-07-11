/// <reference types="jest" />
import { describe, it, expect } from '@jest/globals';
import {
  processFormData,
  convertImagesToBase64,
  getClientId,
} from '@/lib/api/shared';

describe('shared api helpers', () => {
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
    fd.append('userComment', 'note');
    const res = await processFormData(fd);
    expect(res.images).toHaveLength(2);
    expect(res.questionsAndAnswers).toBe('qa');
    expect(res.rankedDiagnoses).toBe('rd');
    expect(res.userComment).toBe('note');
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

  it('getClientId (cost-log grouping) prefers x-pb-client-id then proxy headers', () => {
    const makeReq = (headers: Record<string, string>) =>
      ({ headers: { get: (k: string) => headers[k] || null } }) as any;
    expect(getClientId(makeReq({ 'x-pb-client-id': 'cid' }))).toBe('cid');
    expect(getClientId(makeReq({ 'x-forwarded-for': 'xff' }))).toBe('xff');
    expect(getClientId(makeReq({ 'x-real-ip': 'xri' }))).toBe('xri');
    expect(getClientId(makeReq({}))).toBe('::1');
  });
});
