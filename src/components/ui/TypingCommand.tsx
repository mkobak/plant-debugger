'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

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
  const [displayedPrompt, setDisplayedPrompt] = useState('');
  const [displayedCommand, setDisplayedCommand] = useState('');
  const [isPromptComplete, setIsPromptComplete] = useState(false);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;

    const startTimer = setTimeout(() => {
      hasStarted.current = true;
      
      let currentIndex = 0;
      const typeSpeed = 1000 / speed;

      const typePrompt = setInterval(() => {
        if (currentIndex <= prompt.length) {
          setDisplayedPrompt(prompt.slice(0, currentIndex));
          currentIndex++;
        } else {
          clearInterval(typePrompt);
          setIsPromptComplete(true);
          // Start typing command
          let commandIndex = 0;
          const typeCommand = setInterval(() => {
            if (commandIndex <= command.length) {
              setDisplayedCommand(command.slice(0, commandIndex));
              commandIndex++;
            } else {
              clearInterval(typeCommand);
              if (onComplete) onComplete();
            }
          }, typeSpeed);
        }
      }, typeSpeed);
    }, delay);

    return () => clearTimeout(startTimer);
  }, []); // Empty dependency array

  const showPromptCursor = hasStarted.current && displayedPrompt.length < prompt.length;
  const showCommandCursor = isPromptComplete && displayedCommand.length < command.length;

  return (
    <p className="typing-text prompt-line">
      <span className="prompt">
        {displayedPrompt}
        {showPromptCursor && <span className="typing-cursor">|</span>}
      </span>
      {isPromptComplete && (
        <>
          {' '}
          <Link href={href} className="command-link">
            {displayedCommand}
            {showCommandCursor && <span className="typing-cursor">|</span>}
          </Link>
        </>
      )}
    </p>
  );
}
