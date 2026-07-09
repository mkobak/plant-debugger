/// <reference types="jest" />
import { describe, it, expect } from '@jest/globals';
import {
  collectSuccessfulDiagnoses,
  type DiagnosisAttempt,
} from '@/lib/api/diagnosisSelection';

const attempt = (text: string, modelKey = 'modelMedium'): DiagnosisAttempt =>
  ({ text, usage: {}, modelKey }) as DiagnosisAttempt;

const fulfilled = (value: DiagnosisAttempt) =>
  ({ status: 'fulfilled', value }) as PromiseFulfilledResult<DiagnosisAttempt>;

const rejected = (reason: unknown) =>
  ({ status: 'rejected', reason }) as PromiseRejectedResult;

describe('collectSuccessfulDiagnoses', () => {
  it('keeps all non-empty results', () => {
    const { successes, failures } = collectSuccessfulDiagnoses([
      fulfilled(attempt('Root rot', 'modelHigh')),
      fulfilled(attempt('Spider mites')),
      fulfilled(attempt('Overwatering')),
    ]);
    expect(successes.map((s) => s.text)).toEqual([
      'Root rot',
      'Spider mites',
      'Overwatering',
    ]);
    expect(failures).toEqual([]);
  });

  it('drops rejections but keeps remaining successes (slow pro must not gate flash)', () => {
    const { successes, failures } = collectSuccessfulDiagnoses([
      rejected(new Error('modelHigh call timed out after 30000ms')),
      fulfilled(attempt('Spider mites')),
      fulfilled(attempt('Overwatering')),
    ]);
    expect(successes.map((s) => s.text)).toEqual([
      'Spider mites',
      'Overwatering',
    ]);
    expect(failures).toEqual(['modelHigh call timed out after 30000ms']);
  });

  it('treats empty text as failure with finish/block detail', () => {
    const empty = {
      text: '',
      usage: {},
      modelKey: 'modelHigh',
      finishReason: 'MAX_TOKENS',
    } as DiagnosisAttempt;
    const { successes, failures } = collectSuccessfulDiagnoses([
      fulfilled(empty),
    ]);
    expect(successes).toEqual([]);
    expect(failures[0]).toContain('MAX_TOKENS');
  });

  it('returns empty successes when everything fails', () => {
    const { successes, failures } = collectSuccessfulDiagnoses([
      rejected(new Error('boom')),
      rejected('string reason'),
    ]);
    expect(successes).toEqual([]);
    expect(failures).toEqual(['boom', 'string reason']);
  });
});
