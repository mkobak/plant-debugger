'use client';

import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function Modal({
  isOpen,
  onClose,
  children,
  title,
  size = 'md',
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!mounted || !isOpen) return null;

  const sizeClasses = {
    sm: 'terminal-modal--sm',
    md: 'terminal-modal--md',
    lg: 'terminal-modal--lg',
    xl: 'terminal-modal--xl',
  };

  const modalClasses = ['terminal-modal', sizeClasses[size]]
    .filter(Boolean)
    .join(' ');

  return createPortal(
    <div
      className="terminal-modal-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      <div className={modalClasses}>
        <div className="terminal-modal__header">
          {title && <h3 className="terminal-modal__title">{title}</h3>}
          <button
            className="terminal-modal__close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        <div className="terminal-modal__content">{children}</div>
      </div>
    </div>,
    document.body
  );
}
