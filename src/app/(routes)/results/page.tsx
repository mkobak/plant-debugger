'use client';

import TerminalLayout from '@/components/layout/TerminalLayout';
import SharedHeader from '@/components/layout/SharedHeader';
import TypingText from '@/components/ui/TypingText';
import ActionButton from '@/components/ui/ActionButton';

export default function ResultsPage() {
  return (
    <TerminalLayout title="plant-debugger:~/results$">
      <SharedHeader currentStep={3} showNavigation={true} />
      
      <div className="results-page">
        <div className="terminal-text">
          <TypingText
            text="> Processing diagnosis..."
            speed={60}
          />
          <TypingText
            text="> Aggregating multi-model responses..."
            delay={1000}
            speed={60}
          />
          <TypingText
            text="> Generating comprehensive treatment plan..."
            delay={2000}
            speed={60}
          />
          <br />
          
          <div className="results-placeholder">
            <TypingText
              text="> Results and PDF export functionality will be implemented in Phase 2"
              delay={3000}
              speed={60}
            />
          </div>
        </div>

        <div className="page-actions">
          <ActionButton 
            variant="secondary"
            href="/questions"
          >
            [ Back ]
          </ActionButton>
          
          <ActionButton 
            variant="reset"
            href="/"
          >
            [ New Diagnosis ]
          </ActionButton>
        </div>
      </div>
    </TerminalLayout>
  );
}
