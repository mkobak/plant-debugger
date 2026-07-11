/// <reference types="jest" />
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const generateContent = jest.fn<any>();
const recordUsage = jest.fn();

// jest.doMock is not hoisted, so it reliably registers these mocks before the
// module under test is required (next/jest's SWC transform does not hoist
// jest.mock factories).
jest.doMock('@/lib/api/gemini', () => ({
  getGenAI: () => ({
    models: {
      generateContent: (...args: any[]) => generateContent(...args),
    },
  }),
}));
jest.doMock('@/lib/api/costServer', () => ({
  recordUsageForRequest: (...args: any[]) => recordUsage(...args),
}));

const { geminiCall, isAbortError, GeminiTimeoutError } =
  require('@/lib/api/geminiCall') as typeof import('@/lib/api/geminiCall');

const fakeRequest = {} as any;

const baseOptions = {
  request: fakeRequest,
  modelKey: 'modelLow' as const,
  parts: [{ text: 'prompt' }],
  tag: '[TEST:abc]',
};

describe('geminiCall', () => {
  beforeEach(() => {
    generateContent.mockReset();
    recordUsage.mockClear();
  });

  it('returns trimmed text and records usage', async () => {
    generateContent.mockResolvedValue({
      text: '  Monstera  ',
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
      candidates: [{ finishReason: 'STOP' }],
    });
    const result = await geminiCall(baseOptions);
    expect(result.text).toBe('Monstera');
    expect(result.finishReason).toBe('STOP');
    expect(recordUsage).toHaveBeenCalledWith(fakeRequest, 'modelLow', {
      promptTokenCount: 10,
      candidatesTokenCount: 5,
    });
  });

  it('passes signal and timeout to the SDK', async () => {
    generateContent.mockResolvedValue({ text: 'x', usageMetadata: {} });
    const controller = new AbortController();
    await geminiCall({
      ...baseOptions,
      signal: controller.signal,
      timeoutMs: 12345,
    });
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.any(String),
        config: expect.objectContaining({
          abortSignal: controller.signal,
          httpOptions: { timeout: 12345 },
        }),
      })
    );
  });

  it('throws "aborted" when the client signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      geminiCall({ ...baseOptions, signal: controller.signal })
    ).rejects.toThrow('aborted');
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('classifies SDK abort as client abort when the signal aborted mid-call', async () => {
    const controller = new AbortController();
    const sdkError = new Error('fetch aborted');
    sdkError.name = 'AbortError';
    generateContent.mockImplementation(() => {
      controller.abort();
      return Promise.reject(sdkError);
    });
    const error = await geminiCall({
      ...baseOptions,
      signal: controller.signal,
    }).catch((e) => e);
    expect(isAbortError(error)).toBe(true);
  });

  it('classifies SDK abort as timeout when the signal did not abort', async () => {
    const sdkError = new Error('request timed out');
    sdkError.name = 'AbortError';
    generateContent.mockRejectedValue(sdkError);
    const error = await geminiCall({ ...baseOptions, timeoutMs: 100 }).catch(
      (e) => e
    );
    expect(error).toBeInstanceOf(GeminiTimeoutError);
    expect(isAbortError(error)).toBe(false);
  });

  it('rethrows other SDK errors untouched', async () => {
    generateContent.mockRejectedValue(new Error('quota exceeded'));
    await expect(geminiCall(baseOptions)).rejects.toThrow('quota exceeded');
  });
});

describe('isAbortError', () => {
  it('matches AbortError and the "aborted" marker only', () => {
    const abortErr = new Error('x');
    abortErr.name = 'AbortError';
    expect(isAbortError(abortErr)).toBe(true);
    expect(isAbortError(new Error('aborted'))).toBe(true);
    expect(isAbortError(new Error('other'))).toBe(false);
    expect(isAbortError('aborted')).toBe(false);
  });
});
