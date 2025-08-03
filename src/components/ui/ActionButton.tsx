'use client';

import { useRouter } from 'next/navigation';

interface ActionButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'reset';
  disabled?: boolean;
  type?: 'button' | 'submit';
  href?: string;
  className?: string;
}

export default function ActionButton({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  type = 'button',
  href,
  className = '',
}: ActionButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (href) {
      router.push(href);
    } else if (onClick) {
      onClick();
    }
  };

  const classes = [
    'action-button',
    `action-button--${variant}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={disabled}
      className={classes}
    >
      {children}
    </button>
  );
}
