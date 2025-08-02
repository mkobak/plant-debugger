import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses = 'terminal-button';
  const variantClasses = {
    primary: 'terminal-button--primary',
    secondary: 'terminal-button--secondary',
    danger: 'terminal-button--danger',
  };
  const sizeClasses = {
    sm: 'terminal-button--sm',
    md: 'terminal-button--md',
    lg: 'terminal-button--lg',
  };

  const buttonClasses = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    loading ? 'terminal-button--loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={buttonClasses}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="loading-spinner">
          <span className="spinner-char">|</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
