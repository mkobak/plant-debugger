'use client';

import { useState, useEffect } from 'react';
import TypingText from './TypingText';
import LoadingSpinner from './LoadingSpinner';

interface QuestionsLoadingScreenProps {
  isIdentifying: boolean;
  isGeneratingQuestions: boolean;
  identificationComplete: boolean;
  questionsGenerated: boolean;
  onComplete?: () => void;
  // Optional key to retrigger typing when input changes
  onceKeyPrefix?: string;
  compact?: boolean; // single line status mode
}

export default function QuestionsLoadingScreen({
  isIdentifying,
  isGeneratingQuestions,
  identificationComplete,
  questionsGenerated,
  onComplete,
  onceKeyPrefix,
  compact = true,
}: QuestionsLoadingScreenProps) {
  const [line1Complete, setLine1Complete] = useState(false);
  const [line2Complete, setLine2Complete] = useState(false);
  const [line3Complete, setLine3Complete] = useState(false);

  // Call onComplete when everything is done
  useEffect(() => {
    if (questionsGenerated && line3Complete && onComplete) {
      console.log(
        'QuestionsLoadingScreen: All steps complete, calling onComplete'
      );
      const timer = setTimeout(() => {
        onComplete();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [questionsGenerated, line3Complete, onComplete]);

  if (compact) {
    // Single-line dynamic status
    let status = 'Analyzing images';
    if (isIdentifying) status = 'Identifying plant';
    if (identificationComplete && isGeneratingQuestions)
      status = 'Generating questions';
    if (questionsGenerated) status = 'Finalizing';

    return (
      <div className="questions-loading-screen compact">
        <TypingText
          text={`Status: ${status}...`}
          speed={40}
          onceKey={onceKeyPrefix ? `${onceKeyPrefix}|compact` : undefined}
          onComplete={() => {
            if (questionsGenerated) setLine3Complete(true);
          }}
        >
          <LoadingSpinner />
        </TypingText>
      </div>
    );
  }

  return (
    <div className="questions-loading-screen verbose">
      {/* Original multi-line retained behind flag */}
      <div className="terminal-line">
        <TypingText
          text="> Analyzing images..."
          speed={60}
          onceKey={onceKeyPrefix ? `${onceKeyPrefix}|line1` : undefined}
          onComplete={() => setLine1Complete(true)}
        />
      </div>
      {line1Complete && (
        <div className="terminal-line">
          <TypingText
            text="> Identifying plant..."
            speed={60}
            onceKey={onceKeyPrefix ? `${onceKeyPrefix}|line2` : undefined}
            onComplete={() => setLine2Complete(true)}
          >
            {isIdentifying && <LoadingSpinner />}
          </TypingText>
        </div>
      )}
      {line2Complete && identificationComplete && (
        <div className="terminal-line">
          <TypingText
            text="> Generating questions..."
            speed={60}
            onceKey={onceKeyPrefix ? `${onceKeyPrefix}|line3` : undefined}
            onComplete={() => setLine3Complete(true)}
          >
            {isGeneratingQuestions && <LoadingSpinner />}
          </TypingText>
        </div>
      )}
    </div>
  );
}
