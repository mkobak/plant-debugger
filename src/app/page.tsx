'use client';

import { useState } from 'react';
import TerminalLayout from '@/components/layout/TerminalLayout';
import SharedHeader from '@/components/layout/SharedHeader';
import TypingText from '@/components/ui/TypingText';
import TypingCommand from '@/components/ui/TypingCommand';
import { ASCII_PLANT_LOGO } from '@/lib/constants';

export default function HomePage() {
  const [line1Complete, setLine1Complete] = useState(false);
  const [line2Complete, setLine2Complete] = useState(false);
  const [commandComplete, setCommandComplete] = useState(false);

  return (
    <TerminalLayout>
      <SharedHeader isHomePage={true} />
      <div className="home-content">
        <div className="terminal-text home-text">
          <TypingText 
            text="> Is your plant experiencing some compilation issues?" 
            speed={80}
            onComplete={() => setLine1Complete(true)}
          />
          {line1Complete && (
            <TypingText 
              text="> Run the program below to start debugging." 
              speed={80}
              onComplete={() => setLine2Complete(true)}
            />
          )}
          <br />
          {line2Complete && (
            <div className="home-actions">
              <TypingCommand
                prompt="plant-debugger:~$"
                command="start-debugging"
                href="/upload"
                speed={80}
                onComplete={() => setCommandComplete(true)}
              />
            </div>
          )}
        </div>
        {commandComplete && (
          <div className="plant-logo-container">
            <pre className="ascii-plant-logo">
              {ASCII_PLANT_LOGO}
            </pre>
          </div>
        )}
      </div>
    </TerminalLayout>
  );
}
