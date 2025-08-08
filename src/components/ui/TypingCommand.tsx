'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useTyping } from '@/hooks/useTyping';

interface TypingCommandProps {
  prompt: string;
  command: string;
  href: string;
  delay?: number;
  speed?: number;
  onComplete?: () => void;
}

export default function TypingCommand({
  prompt,
  command,
  href,
  delay = 300,
  speed = 60,
  onComplete,
}: TypingCommandProps) {
  const promptTyping = useTyping({ text: prompt, delay, cps: speed });
  const commandTyping = useTyping({ text: command, delay: delay + Math.max(0, prompt.length) * (1000 / speed), cps: speed, onComplete });
  const showPromptCursor = promptTyping.started && !promptTyping.complete;
  const showCommandCursor = commandTyping.started && !commandTyping.complete;

  return (
    <p className="typing-text prompt-line">
      <span className="prompt">
        {promptTyping.display}
        {showPromptCursor && <span className="typing-cursor">|</span>}
      </span>
      {promptTyping.complete && (
        <>
          {' '}
          <Link href={href} className="command-link">
            {commandTyping.display}
            {showCommandCursor && <span className="typing-cursor">|</span>}
          </Link>
        </>
      )}
    </p>
  );
}
