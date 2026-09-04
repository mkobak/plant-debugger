'use client';

import TerminalLayout from '@/components/layout/TerminalLayout';
import SharedHeader from '@/components/layout/SharedHeader';
import { logger } from '@/lib/logger';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Unhandled page error', error);
  }, [error]);

  return (
    <TerminalLayout title="Plant Debugger">
      <SharedHeader showNavigation={false} />
      <div className="terminal-text">
        <p>Segmentation fault (core dumped).</p>
        <p>Something went wrong rendering this page.</p>
        <p>
          <button className="text-action" onClick={reset}>
            retry
          </button>
          {'  '}
          {/* Full reload on purpose: the client router may be what broke */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="text-action">
            cd ~/home
          </a>
        </p>
      </div>
    </TerminalLayout>
  );
}
