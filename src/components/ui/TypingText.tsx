'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { typingSession } from '@/lib/typingSession';

interface TypingTextProps {
  text: string;
  delay?: number; // ms before starting
  className?: string;
  onComplete?: () => void;
  speed?: number; // characters per second
  as?: 'p' | 'span'; // wrapper element
  onceKey?: string; // use to group re-renders of the same logical text
  children?: React.ReactNode; // optional inline suffix (e.g. spinner)
}

export default function TypingText({
  text,
  delay = 100,
  className = '',
  onComplete,
  speed = 100,
  as = 'p',
  onceKey,
  children,
}: TypingTextProps) {
  const [display, setDisplay] = useState('');
  const [complete, setComplete] = useState(false);
  const [started, setStarted] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  // Callers pass inline arrows; keeping the latest in a ref means parent
  // re-renders don't restart the typing effect (which visibly flickers when
  // the parent re-renders often, e.g. during streamed results)
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const key = useMemo(() => onceKey ?? text, [onceKey, text]);

  useEffect(() => {
    // Reset local state when text changes
    setDisplay('');
    setComplete(false);
    setStarted(false);

    // Respect prefers-reduced-motion: render instantly, no typing animation
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // If we've already typed this text once this session, render instantly
    if (prefersReducedMotion || typingSession.has(key)) {
      setDisplay(text);
      setComplete(true);
      setStarted(true);
      // Ensure any chaining still fires
      const id = window.setTimeout(() => onCompleteRef.current?.(), 0);
      timeoutRef.current = id;
      return () => {
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      };
    }

    // Otherwise, type it out
    const startId = window.setTimeout(() => {
      setStarted(true);
      let i = 0;
      const interval = Math.max(1, Math.floor(1000 / speed));
      const id = window.setInterval(() => {
        if (i <= text.length) {
          setDisplay(text.slice(0, i));
          i++;
        } else {
          if (intervalRef.current) window.clearInterval(intervalRef.current);
          typingSession.add(key);
          setComplete(true);
          // small delay to allow cursor to blink once
          const completeId = window.setTimeout(
            () => onCompleteRef.current?.(),
            100
          );
          timeoutRef.current = completeId;
        }
      }, interval);
      intervalRef.current = id;
    }, delay);

    timeoutRef.current = startId;

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
    // onComplete deliberately omitted (read via ref): unstable identities
    // from inline arrows must not restart the animation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, delay, speed, key]);

  // If a global typing reset happens, allow re-typing next render
  useEffect(() => {
    const handler = () => {
      setDisplay('');
      setComplete(false);
      setStarted(false);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('typing:reset', handler);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('typing:reset', handler);
      }
    };
  }, []);

  const baseClasses = 'typing-text';
  const classes = [baseClasses, className].filter(Boolean).join(' ');

  const showCursor = started && !complete;

  const Element = as === 'span' ? 'span' : 'p';

  return (
    <Element className={classes}>
      {display}
      {showCursor && <span className="typing-cursor">|</span>}
      {children}
    </Element>
  );
}
