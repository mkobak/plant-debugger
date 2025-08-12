interface ProgressBarProps {
  progress: number; // Progress value (0-100)
  className?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function ProgressBar({
  progress,
  className = '',
  showPercentage = true,
  size = 'md',
}: ProgressBarProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  const sizeClasses = {
    sm: 'terminal-progress--sm',
    md: 'terminal-progress--md',
    lg: 'terminal-progress--lg',
  };

  const progressClasses = ['terminal-progress', sizeClasses[size], className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={progressClasses}>
      <div className="terminal-progress__track">
        <div
          className="terminal-progress__fill"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
      {showPercentage && (
        <span className="terminal-progress__percentage">
          {Math.round(clampedProgress)}%
        </span>
      )}
    </div>
  );
}
