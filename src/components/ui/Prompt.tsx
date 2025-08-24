'use client';

import React, { useEffect, useState } from 'react';

interface PromptProps {
  path: string; // e.g. ~/upload
  user?: string;
  host?: string;
  className?: string;
  showCursor?: boolean;
  cursorDurationMs?: number;
}

/**
 * Shell-style prompt (user@host:path$). Visual only.
 */
export function Prompt({
  path,
  user = 'user',
  host = 'plant-debugger',
  className = '',
  showCursor,
}: PromptProps) {
  const [visible, setVisible] = useState(showCursor !== false);

  useEffect(() => {
    setVisible(showCursor !== false);
  }, [showCursor, path]);

  return (
    <span className={['pd-prompt', className].filter(Boolean).join(' ')}>
      <span className="pd-prompt__user">{user}</span>
      <span className="pd-prompt__at">@</span>
      <span className="pd-prompt__host">{host}</span>
      <span className="pd-prompt__sep">:</span>
      <span className="pd-prompt__path">{path}</span>
      <span className="pd-prompt__char">$</span>
      {visible && <span className="pd-prompt__cursor">▋</span>}
    </span>
  );
}

export default Prompt;
