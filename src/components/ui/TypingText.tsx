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
}

export default function TypingText({
  text,
  delay = 300,
  className = '',
  onComplete,
  speed = 60,
  as = 'p',
  onceKey,
}: TypingTextProps) {
  const [display, setDisplay] = useState('');
  const [complete, setComplete] = useState(false);
  const [started, setStarted] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const key = useMemo(() => (onceKey ?? text), [onceKey, text]);

  useEffect(() => {
    // Reset local state when text changes
    setDisplay('');
    setComplete(false);
    setStarted(false);

    // If we've already typed this text once this session, render instantly
  if (typingSession.has(key)) {
      setDisplay(text);
      setComplete(true);
      setStarted(true);
      // Ensure any chaining still fires
      const id = window.setTimeout(() => onComplete?.(), 0);
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
          const completeId = window.setTimeout(() => onComplete?.(), 100);
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
  }, [text, delay, speed, onComplete, key]);

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
  const classes = [baseClasses, className]
    .filter(Boolean)
    .join(' ');

  const showCursor = started && !complete;

  const Element = as === 'span' ? 'span' : 'p';

  return (
    <Element className={classes}>
      {display}
      {showCursor && <span className="typing-cursor">|</span>}
    </Element>
  );
}
