/// <reference types="jest" />
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';

const getInitialDiagnosis = jest.fn<any>();
const getFinalDiagnosis = jest.fn<any>();

jest.doMock('@/lib/api/diagnosis', () => ({
  getInitialDiagnosis: (...args: any[]) => getInitialDiagnosis(...args),
  getFinalDiagnosis: (...args: any[]) => getFinalDiagnosis(...args),
}));
jest.doMock('@/lib/persistence', () => ({
  saveDiagnosisState: () => Promise.resolve(),
  loadDiagnosisState: () => Promise.resolve(null),
  clearDiagnosisState: () => Promise.resolve(),
}));

const { useDiagnosisFlow } =
  require('@/hooks/useDiagnosisFlow') as typeof import('@/hooks/useDiagnosisFlow');
const { DiagnosisProvider } =
  require('@/context/DiagnosisContext') as typeof import('@/context/DiagnosisContext');

const wrapper = ({ children }: { children: ReactNode }) => (
  <DiagnosisProvider>{children}</DiagnosisProvider>
);

const images = [{ id: 'img1', file: {} as File, url: 'blob:x', size: 10 }];

const finalResult = {
  primary: {
    condition: 'Root rot',
    confidence: 'High',
    summary: 's',
    reasoning: 'r',
    treatment: 't',
    prevention: 'p',
  },
  careTips: 'c',
  plant: 'Monstera',
};

describe('useDiagnosisFlow', () => {
  beforeEach(() => {
    getInitialDiagnosis.mockReset();
    getFinalDiagnosis.mockReset();
  });

  it('skips initial diagnosis when rankedDiagnoses provided and stores the final result', async () => {
    getFinalDiagnosis.mockResolvedValue(finalResult);

    const { result } = renderHook(
      () =>
        useDiagnosisFlow({
          images,
          questionsAndAnswers: 'Q&A',
          rankedDiagnoses: 'Root rot, Spider mites',
          userComment: 'note',
        }),
      { wrapper }
    );

    await act(async () => {
      await result.current.startDiagnosis();
    });

    expect(getInitialDiagnosis).not.toHaveBeenCalled();
    expect(getFinalDiagnosis).toHaveBeenCalledWith(
      images,
      'Q&A',
      'Root rot, Spider mites',
      'note',
      expect.anything(),
      expect.any(Function)
    );
    await waitFor(() => {
      expect(result.current.diagnosisResult).toEqual(finalResult);
      expect(result.current.finalDiagnosisComplete).toBe(true);
      expect(result.current.isDiagnosing).toBe(false);
    });
  });

  it('runs initial diagnosis first when no rankedDiagnoses given', async () => {
    getInitialDiagnosis.mockResolvedValue({
      identification: { name: 'Monstera' },
      rawDiagnoses: ['Root rot'],
      rankedDiagnoses: 'Root rot',
    });
    getFinalDiagnosis.mockResolvedValue(finalResult);

    const { result } = renderHook(
      () =>
        useDiagnosisFlow({
          images,
          questionsAndAnswers: '',
        }),
      { wrapper }
    );

    await act(async () => {
      await result.current.startDiagnosis();
    });

    expect(getInitialDiagnosis).toHaveBeenCalledTimes(1);
    expect(getFinalDiagnosis).toHaveBeenCalledWith(
      images,
      '',
      'Root rot',
      '',
      expect.anything(),
      expect.any(Function)
    );
    await waitFor(() =>
      expect(result.current.diagnosisResult).toEqual(finalResult)
    );
  });

  it('retries the final step once, then succeeds', async () => {
    jest.useFakeTimers();
    getFinalDiagnosis
      .mockRejectedValueOnce(new Error('server hiccup'))
      .mockResolvedValueOnce(finalResult);

    const { result } = renderHook(
      () =>
        useDiagnosisFlow({
          images,
          questionsAndAnswers: '',
          rankedDiagnoses: 'Root rot',
        }),
      { wrapper }
    );

    await act(async () => {
      await result.current.startDiagnosis();
    });
    // First attempt failed; a retry is scheduled in 3s
    expect(getFinalDiagnosis).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe('');

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await act(async () => {
      jest.useRealTimers();
    });

    await waitFor(() => {
      expect(getFinalDiagnosis).toHaveBeenCalledTimes(2);
      expect(result.current.diagnosisResult).toEqual(finalResult);
    });
  });

  it('surfaces an error after retries are exhausted', async () => {
    jest.useFakeTimers();
    getFinalDiagnosis.mockRejectedValue(new Error('persistent failure'));

    const { result } = renderHook(
      () =>
        useDiagnosisFlow({
          images,
          questionsAndAnswers: '',
          rankedDiagnoses: 'Root rot',
        }),
      { wrapper }
    );

    await act(async () => {
      await result.current.startDiagnosis();
    });
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await act(async () => {
      jest.useRealTimers();
    });

    await waitFor(() => {
      expect(result.current.error).toContain('persistent failure');
      expect(result.current.isDiagnosing).toBe(false);
      expect(result.current.diagnosisResult).toBeNull();
    });
  });
});
