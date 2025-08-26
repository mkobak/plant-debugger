'use client';

import { useState, useEffect } from 'react';
import TypingText from './TypingText';
import LoadingSpinner from './LoadingSpinner';

interface QuestionsLoadingScreenProps {
  isIdentifying: boolean;
  isInvestigating: boolean; // initial diagnoses aggregation phase
  isGeneratingQuestions: boolean; // clarifying questions phase
  identificationComplete: boolean;
  questionsGenerated: boolean;
  onComplete?: () => void;
  // Optional key to retrigger typing when input changes
  onceKeyPrefix?: string;
  compact?: boolean; // single line status mode
}

export default function QuestionsLoadingScreen({
  isIdentifying,
  isInvestigating,
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
    if (identificationComplete && isInvestigating)
      status = 'Investigating possible bugs';
    if (!isInvestigating && isGeneratingQuestions && !questionsGenerated)
      status = 'Generating questions';
    if (questionsGenerated) status = 'Finalizing';

    return (
      <div className="questions-loading-screen compact">
        <TypingText
          text={`Status: ${status}...`}
          speed={100}
          // Include status so each transition retypes once
          onceKey={
            onceKeyPrefix ? `${onceKeyPrefix}|compact|${status}` : undefined
          }
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
          speed={100}
          onceKey={onceKeyPrefix ? `${onceKeyPrefix}|analyzing` : undefined}
          onComplete={() => setLine1Complete(true)}
        />
      </div>
      {line1Complete && (
        <div className="terminal-line">
          <TypingText
            text="> Identifying plant..."
            speed={100}
            onceKey={onceKeyPrefix ? `${onceKeyPrefix}|identifying` : undefined}
            onComplete={() => setLine2Complete(true)}
          >
            {isIdentifying && <LoadingSpinner />}
          </TypingText>
        </div>
      )}
      {line2Complete && identificationComplete && (
        <div className="terminal-line">
          <TypingText
            text="> Investigating possible bugs..."
            speed={100}
            onceKey={
              onceKeyPrefix ? `${onceKeyPrefix}|investigating` : undefined
            }
            onComplete={() => setLine3Complete(true)}
          >
            {isInvestigating && <LoadingSpinner />}
          </TypingText>
        </div>
      )}
      {line3Complete && identificationComplete && !questionsGenerated && (
        <div className="terminal-line">
          <TypingText
            text="> Generating questions..."
            speed={100}
            onceKey={
              onceKeyPrefix
                ? `${onceKeyPrefix}|generating_questions`
                : undefined
            }
            onComplete={() => setLine3Complete(true)}
          >
            {isGeneratingQuestions && <LoadingSpinner />}
          </TypingText>
        </div>
      )}
    </div>
  );
}
