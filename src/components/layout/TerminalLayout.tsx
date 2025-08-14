'use client';

import { ReactNode } from 'react';

interface TerminalLayoutProps {
  children: ReactNode;
  title?: string;
  showControls?: boolean;
}

export default function TerminalLayout({
  children,
  title = 'Plant Debugger',
  showControls = true,
}: TerminalLayoutProps) {
  return (
    <main className="terminal-container">
      <div className="terminal-header">
        {showControls && (
          <div className="terminal-controls">
            <span className="control close" />
            <span className="control minimize" />
            <span className="control maximize" />
          </div>
        )}
        {title && <span className="terminal-title">{title}</span>}
      </div>
      <div className="terminal-content">{children}</div>
    </main>
  );
}
