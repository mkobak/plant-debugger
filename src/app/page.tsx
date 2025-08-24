'use client';

import TerminalLayout from '@/components/layout/TerminalLayout';
import SharedHeader from '@/components/layout/SharedHeader';
import ASCIILogo from '@/components/ui/ASCIILogo';
import ActionButton from '@/components/ui/ActionButton';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

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
        </div>
        <div className="plant-logo-container">
          <ASCIILogo variant="plant" className="plant-logo" />
        </div>
      </div>
    </TerminalLayout>
  );
}
