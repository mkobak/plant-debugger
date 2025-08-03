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
}

export default function LoadingScreen({ 
  isDiagnosing = true, 
  isAggregating = true,
  isGeneratingTreatment = false,
  aggregatingComplete = false,
  finalDiagnosisComplete = false, 
  onComplete 
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

  return (
    <div className="loading-screen">
      <TypingText
        text="> Processing diagnosis..."
        speed={60}
        onComplete={() => setLine1Complete(true)}
      />
      
      {line1Complete && (
        <div className="terminal-line">
          <TypingText
            text="> Aggregating multi-model responses"
            speed={60}
            delay={1000}
            onComplete={() => setLine2Complete(true)}
          />
          {isAggregating && <LoadingSpinner />}
        </div>
      )}
      
      {line2Complete && aggregatingComplete && (
        <div className="terminal-line">
          <TypingText
            text="> Generating comprehensive treatment plan"
            speed={60}
            delay={2000}
            onComplete={handleLine3Complete}
          />
          {isGeneratingTreatment && <LoadingSpinner />}
        </div>
      )}
    </div>
  );
}
