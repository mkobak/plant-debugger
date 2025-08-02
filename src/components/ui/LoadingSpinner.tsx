'use client';

import { useEffect, useState } from 'react';
import { LOADING_SPINNER_CHARS } from '@/lib/constants';

interface LoadingSpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingSpinner({
  className = '',
  size = 'md',
}: LoadingSpinnerProps) {
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCharIndex((prev) => (prev + 1) % LOADING_SPINNER_CHARS.length);
    }, 150);

    return () => clearInterval(interval);
  }, []);

  const sizeClasses = {
    sm: 'terminal-spinner--sm',
    md: 'terminal-spinner--md',
    lg: 'terminal-spinner--lg',
  };

  const spinnerClasses = ['terminal-spinner', sizeClasses[size], className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={spinnerClasses}>
      {LOADING_SPINNER_CHARS[charIndex]}
    </span>
  );
}
