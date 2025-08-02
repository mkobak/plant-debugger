'use client';

import { ReactNode } from 'react';

interface TerminalLayoutProps {
  children: ReactNode;
  title?: string;
  showControls?: boolean;
}

export default function TerminalLayout({
  children,
  title = 'plant-debugger:~$',
  showControls = true,
}: TerminalLayoutProps) {
  return (
    <main className="terminal-container">
      <div className="terminal-header">
        {showControls && (
          <div className="terminal-controls">
            <span className="control close"></span>
            <span className="control minimize"></span>
            <span className="control maximize"></span>
          </div>
        )}
        <span className="terminal-title">{title}</span>
      </div>
      
      <div className="terminal-content">
        {children}
      </div>
    </main>
  );
}
