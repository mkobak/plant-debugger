/// <reference types="jest" />
// Use the manual mock from __mocks__/next/navigation.ts
jest.mock('next/navigation');

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import React from 'react';
import { render, act } from '@testing-library/react';
import { DiagnosisProvider, useDiagnosis } from '@/context/DiagnosisContext';
import { useNavigation } from '@/hooks/useNavigation';
import * as nextNavigation from 'next/navigation';
const mockedRouter: any = (nextNavigation as any).__router;

function NavHarness() {
  const nav = useNavigation();
  const ctx = useDiagnosis();
  // expose on window for test to call
  (window as any).__nav = nav;
  (window as any).__ctx = ctx;
  return null;
}

describe('useNavigation', () => {
  beforeEach(() => {
    mockedRouter.push.mockReset();
    (window as any).__nav = undefined;
    (window as any).__ctx = undefined;
  });

  const renderWithProvider = () =>
    render(
      <DiagnosisProvider>
        <NavHarness />
      </DiagnosisProvider>
    );

  it('goHome resets and navigates to /', () => {
    renderWithProvider();
    act(() => {
      (window as any).__nav.goHome();
    });
    expect(mockedRouter.push).toHaveBeenCalledWith('/');
  });

  it('goToQuestions routes to upload when no images, then questions when images exist', () => {
    renderWithProvider();
    (window as any).__nav.goToQuestions();
    expect(mockedRouter.push).toHaveBeenCalledWith('/upload');

    act(() => {
      (window as any).__ctx.setImages([
        {
          id: '1',
          url: 'u',
          size: 1,
          file: new File([new Uint8Array([1])], 'a.jpg'),
        },
      ]);
    });
    (window as any).__nav.goToQuestions();
    expect(mockedRouter.push).toHaveBeenLastCalledWith('/analysis');
  });

  it('goToResults routes based on images presence', () => {
    renderWithProvider();
    (window as any).__nav.goToResults();
    expect(mockedRouter.push).toHaveBeenCalledWith('/upload');

    act(() => {
      (window as any).__ctx.setImages([
        {
          id: '1',
          url: 'u',
          size: 1,
          file: new File([new Uint8Array([1])], 'a.jpg'),
        },
      ]);
    });
    (window as any).__nav.goToResults();
    expect(mockedRouter.push).toHaveBeenLastCalledWith('/results');
  });
});
