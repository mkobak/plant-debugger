'use client';

import { useEffect, useRef, useState } from 'react';

interface UseTypingOptions {
  text: string;
  delay?: number; // ms before starting
  cps?: number; // characters per second
  onComplete?: () => void;
}

export function useTyping({ text, delay = 300, cps = 60, onComplete }: UseTypingOptions) {
  const [display, setDisplay] = useState('');
  const [complete, setComplete] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!text || startedRef.current) return;
    const startTimer = setTimeout(() => {
      startedRef.current = true;
      let i = 0;
      const interval = Math.max(1, Math.floor(1000 / cps));
      const id = setInterval(() => {
        if (i <= text.length) {
          setDisplay(text.slice(0, i));
          i++;
        } else {
          clearInterval(id);
          setComplete(true);
          // small delay to allow cursor to blink once
          setTimeout(() => onComplete?.(), 100);
        }
      }, interval);
    }, delay);
    return () => clearTimeout(startTimer);
  }, [text, delay, cps, onComplete]);

  return { display, complete, started: startedRef.current } as const;
}
