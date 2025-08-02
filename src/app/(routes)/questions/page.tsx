'use client';

import { useEffect, useState } from 'react';
import TerminalLayout from '@/components/layout/TerminalLayout';
import SharedHeader from '@/components/layout/SharedHeader';
import TypingText from '@/components/ui/TypingText';
import ActionButton from '@/components/ui/ActionButton';
import { useDiagnosis } from '@/context/DiagnosisContext';

export default function QuestionsPage() {
  const { setCurrentStep } = useDiagnosis();
  const [line1Complete, setLine1Complete] = useState(false);
  const [line2Complete, setLine2Complete] = useState(false);
  const [line3Complete, setLine3Complete] = useState(false);

  useEffect(() => {
    setCurrentStep(2);
  }, [setCurrentStep]);

  return (
    <TerminalLayout title="plant-debugger:~/questions$">
      <SharedHeader currentStep={2} showNavigation={true} />
      
      <div className="questions-page">
        <div className="terminal-text">
          <TypingText
            text="> Analyzing uploaded images..."
            speed={80}
            onComplete={() => setLine1Complete(true)}
          />
          {line1Complete && (
            <TypingText
              text="> Plant species identification in progress..."
              speed={80}
              onComplete={() => setLine2Complete(true)}
            />
          )}
          {line2Complete && (
            <TypingText
              text="> Generating diagnostic questions..."
              speed={80}
              onComplete={() => setLine3Complete(true)}
            />
          )}
          <br />
          
          {line3Complete && (
            <div className="questions-placeholder">
              <TypingText
                text="> Questions functionality will be implemented in Phase 2"
                speed={80}
              />
            </div>
          )}
        </div>

        <div className="page-actions">
          <ActionButton 
            variant="reset"
            href="/"
          >
            [ Reset ]
          </ActionButton>
          
          <ActionButton 
            variant="primary"
            href="/results"
          >
            [ Next ]
          </ActionButton>
        </div>
      </div>
    </TerminalLayout>
  );
}
