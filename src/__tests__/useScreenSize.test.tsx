/// <reference types="jest" />
import { describe, it, expect } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { useScreenSize } from '@/hooks/useScreenSize';

describe('useScreenSize', () => {
  it('reports correct breakpoints and updates on resize', () => {
    // initial
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 800,
    });

    const { result } = renderHook(() => useScreenSize());
    expect(result.current.isSmall).toBe(true);
    expect(result.current.isMedium).toBe(false);
    expect(result.current.isLarge).toBe(false);

    // resize to medium
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 800,
      });
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current.isSmall).toBe(false);
    expect(result.current.isMedium).toBe(true);
    expect(result.current.isLarge).toBe(false);

    // resize to large
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 1200,
      });
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current.isSmall).toBe(false);
    expect(result.current.isMedium).toBe(false);
    expect(result.current.isLarge).toBe(true);
  });
});
