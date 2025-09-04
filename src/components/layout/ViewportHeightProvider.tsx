'use client';

import { useEffect } from 'react';

// Maintain a CSS var --app-height matching the visual viewport height to avoid
// mobile browser UI chrome issues that cause 100vh / dvh mis-measurements.
export function ViewportHeightProvider() {
  useEffect(() => {
    const root = document.documentElement;
    const set = () => {
      const h = window.visualViewport?.height || window.innerHeight;
      root.style.setProperty('--app-height', `${Math.round(h)}px`);
    };
    set();
    window.addEventListener('resize', set);
    window.addEventListener('orientationchange', set);
    window.visualViewport?.addEventListener('resize', set);
    window.visualViewport?.addEventListener('scroll', set);
    return () => {
      window.removeEventListener('resize', set);
      window.removeEventListener('orientationchange', set);
      window.visualViewport?.removeEventListener('resize', set);
      window.visualViewport?.removeEventListener('scroll', set);
    };
  }, []);
  return null;
}
