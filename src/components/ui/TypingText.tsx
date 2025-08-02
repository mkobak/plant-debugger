'use client';

import { useEffect, useState, useRef } from 'react';

interface TypingTextProps {
  text: string;
  delay?: number;
  className?: string;
  onComplete?: () => void;
  speed?: number; // Characters per second
}

export default function TypingText({
  text,
  delay = 300,
  className = '',
  onComplete,
  speed = 60, 
}: TypingTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!text || hasStarted.current) return;

    const startTimer = setTimeout(() => {
      hasStarted.current = true;
      let currentIndex = 0;
      const typeSpeed = 1000 / speed; // Convert to milliseconds per character

      const typeTimer = setInterval(() => {
        if (currentIndex <= text.length) {
          setDisplayedText(text.slice(0, currentIndex));
          currentIndex++;
        } else {
          clearInterval(typeTimer);
          setIsComplete(true);
          // Small delay before completing to ensure cursor shows briefly
          setTimeout(() => {
            onComplete?.();
          }, 100);
        }
      }, typeSpeed);

      return () => clearInterval(typeTimer);
    }, delay);

    return () => clearTimeout(startTimer);
  }, []); // Empty dependency array to prevent re-running

  const baseClasses = 'typing-text';
  const classes = [baseClasses, className]
    .filter(Boolean)
    .join(' ');

  const showCursor = hasStarted.current && !isComplete;

  return (
    <p className={classes}>
      {displayedText}
      {showCursor && <span className="typing-cursor">|</span>}
    </p>
  );
}
