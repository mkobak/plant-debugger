import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
}

export default function Card({ children, className = '', title }: CardProps) {
  const cardClasses = ['terminal-card', className].filter(Boolean).join(' ');

  return (
    <div className={cardClasses}>
      {title && <div className="terminal-card__header">{title}</div>}
      <div className="terminal-card__content">{children}</div>
    </div>
  );
}
