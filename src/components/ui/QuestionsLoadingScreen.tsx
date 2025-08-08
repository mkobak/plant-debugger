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
}

export default function QuestionsLoadingScreen({ 
  isIdentifying, 
  isGeneratingQuestions, 
  identificationComplete, 
  questionsGenerated,
  onComplete,
  onceKeyPrefix
}: QuestionsLoadingScreenProps) {
  const [line1Complete, setLine1Complete] = useState(false);
  const [line2Complete, setLine2Complete] = useState(false);
  const [line3Complete, setLine3Complete] = useState(false);

  // Call onComplete when everything is done
  useEffect(() => {
    if (questionsGenerated && line3Complete && onComplete) {
      console.log('QuestionsLoadingScreen: All steps complete, calling onComplete');
      const timer = setTimeout(() => {
        onComplete();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [questionsGenerated, line3Complete, onComplete]);

  return (
    <div className="questions-loading-screen">
      <div className="terminal-line">
        <TypingText
          text="> Analyzing images..."
          speed={60}
          onceKey={onceKeyPrefix ? `${onceKeyPrefix}|line1` : undefined}
          onComplete={() => {
            console.log('QuestionsLoadingScreen: Line 1 complete');
            setLine1Complete(true);
          }}
        />
      </div>
      
      {line1Complete && (
        <div className="terminal-line">
          <TypingText
            text="> Identifying plant..."
            speed={60}
            onceKey={onceKeyPrefix ? `${onceKeyPrefix}|line2` : undefined}
            onComplete={() => {
              console.log('QuestionsLoadingScreen: Line 2 complete');
              setLine2Complete(true);
            }}
          />
          {isIdentifying && <LoadingSpinner />}
        </div>
      )}
      
      {line2Complete && identificationComplete && (
        <div className="terminal-line">
          <TypingText
            text="> Generating questions..."
            speed={60}
            onceKey={onceKeyPrefix ? `${onceKeyPrefix}|line3` : undefined}
            onComplete={() => {
              console.log('QuestionsLoadingScreen: Line 3 complete');
              setLine3Complete(true);
            }}
          />
          {isGeneratingQuestions && <LoadingSpinner />}
        </div>
      )}
    </div>
  );
}
