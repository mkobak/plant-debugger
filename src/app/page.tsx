'use client';

import { useState } from 'react';
import TerminalLayout from '@/components/layout/TerminalLayout';
import SharedHeader from '@/components/layout/SharedHeader';
import TypingText from '@/components/ui/TypingText';
import ASCIILogo from '@/components/ui/ASCIILogo';
import { useDiagnosis } from '@/context/DiagnosisContext';
import Link from 'next/link';

export default function HomePage() {
  const [line1Complete, setLine1Complete] = useState(false);
  const [line2Complete, setLine2Complete] = useState(false);
  const [promptComplete, setPromptComplete] = useState(false);
  const [commandComplete, setCommandComplete] = useState(false);
  useDiagnosis(); // keep hook for potential future data; no step management

  return (
    <TerminalLayout>
      <SharedHeader isHomePage={true} />
      <div className="home-content">
        <div className="terminal-text home-text">
          <TypingText 
            text="> Is your plant experiencing some compilation issues?" 
            speed={100}
            onComplete={() => setLine1Complete(true)}
          />
          {line1Complete && (
            <TypingText 
              text="> Run the program below to start debugging." 
              speed={100}
              onComplete={() => setLine2Complete(true)}
            />
          )}
          <br />
          {line2Complete && (
            <div className="home-actions">
              <p className="typing-text prompt-line">
                <TypingText 
                  as="span"
                  text="plant-debugger:~$"
                  speed={100}
                  onComplete={() => setPromptComplete(true)}
                />
                {promptComplete && (
                  <>
                    {' '}
                    <Link href="/upload" className="command-link">
                      <TypingText 
                        as="span" 
                        text="start-debugging" 
                        speed={100}
                        onComplete={() => setCommandComplete(true)}
                      />
                    </Link>
                  </>
                )}
              </p>
            </div>
          )}
        </div>
  {commandComplete && (
          <div className="plant-logo-container">
            <ASCIILogo variant="plant" className="plant-logo" />
          </div>
        )}
      </div>
    </TerminalLayout>
  );
}
