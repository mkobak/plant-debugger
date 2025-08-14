'use client';

import { useState, useEffect } from 'react';
import TypingText from './TypingText';
import LoadingSpinner from './LoadingSpinner';

interface LoadingScreenProps {
  isDiagnosing?: boolean;
  isAggregating?: boolean;
  isGeneratingTreatment?: boolean;
  aggregatingComplete?: boolean;
  finalDiagnosisComplete?: boolean;
  onComplete?: () => void;
  onceKeyPrefix?: string;
  compact?: boolean; // single line status mode
}

export default function LoadingScreen({
  isDiagnosing = true,
  isAggregating = true,
  isGeneratingTreatment = false,
  aggregatingComplete = false,
  finalDiagnosisComplete = false,
  onComplete,
  onceKeyPrefix,
  compact = true,
}: LoadingScreenProps) {
  const [line1Complete, setLine1Complete] = useState(false);
  const [line2Complete, setLine2Complete] = useState(false);
  const [line3Complete, setLine3Complete] = useState(false);

  const handleLine3Complete = () => {
    setLine3Complete(true);
  };

  // Call onComplete when diagnosis is complete
  useEffect(() => {
    if (finalDiagnosisComplete && line3Complete && onComplete) {
      const timer = setTimeout(() => {
        onComplete();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [finalDiagnosisComplete, line3Complete, onComplete]);

  if (compact) {
    let status = 'Processing answers';
    if (isAggregating) status = 'Investigating possible bugs';
    if (aggregatingComplete && isGeneratingTreatment) status = 'Generating report';
    if (finalDiagnosisComplete) status = 'Finalizing';
    return (
      <div className="loading-screen compact">
        <TypingText
          text={`Status: ${status}...`}
          speed={45}
          onceKey={onceKeyPrefix ? `${onceKeyPrefix}|compact` : undefined}
          onComplete={() => {
            if (finalDiagnosisComplete) handleLine3Complete();
          }}
        />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="loading-screen verbose">
      <div className="terminal-line">
        <TypingText
          text="> Processing answers..."
          speed={60}
          onceKey={onceKeyPrefix ? `${onceKeyPrefix}|line1` : undefined}
          onComplete={() => setLine1Complete(true)}
        />
      </div>
      {line1Complete && (
        <div className="terminal-line">
          <TypingText
            text="> Investigating possible bugs..."
            speed={60}
            onceKey={onceKeyPrefix ? `${onceKeyPrefix}|line2` : undefined}
            onComplete={() => setLine2Complete(true)}
          />
          {isAggregating && <LoadingSpinner />}
        </div>
      )}
      {line2Complete && aggregatingComplete && (
        <div className="terminal-line">
          <TypingText
            text="> Generating report..."
            speed={60}
            onceKey={onceKeyPrefix ? `${onceKeyPrefix}|line3` : undefined}
            onComplete={handleLine3Complete}
          />
          {isGeneratingTreatment && <LoadingSpinner />}
        </div>
      )}
    </div>
  );
}
