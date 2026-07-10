'use client';

import { useEffect, useState } from 'react';
import TerminalLayout from '@/components/layout/TerminalLayout';
import SharedHeader from '@/components/layout/SharedHeader';
import ASCIILogo from '@/components/ui/ASCIILogo';
import ActionButton from '@/components/ui/ActionButton';
import { useRouter } from 'next/navigation';
import { listHistoryEntries } from '@/lib/history';

export default function HomePage() {
  const router = useRouter();
  const [historyCount, setHistoryCount] = useState(0);

  useEffect(() => {
    listHistoryEntries().then((entries) => setHistoryCount(entries.length));
  }, []);

  return (
    <TerminalLayout>
      <SharedHeader isHomePage={true} />
      <div className="home-content">
        <div className="terminal-text home-text">
          <div className="home-intro-copy">
            <p>Is your plant experiencing compilation issues?</p>
            <p>Click the button below to start debugging.</p>
          </div>
          <div className="home-start-line">
            <ActionButton
              variant="primary"
              onClick={() => router.push('/upload')}
              className="home-start-button"
            >
              Start
            </ActionButton>
          </div>
          {historyCount > 0 && (
            <p className="home-history-link">
              <button
                className="sample-image-link"
                onClick={() => router.push('/history')}
              >
                View past diagnoses ({historyCount})
              </button>
            </p>
          )}
        </div>
        <div className="plant-logo-container">
          <ASCIILogo variant="plant" className="plant-logo" />
        </div>
      </div>
    </TerminalLayout>
  );
}
