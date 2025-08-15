import React from 'react';
import Image from 'next/image';

interface ASCIILogoProps {
  variant: 'single' | 'two-lines' | 'plant';
  className?: string;
  alt?: string;
  onClick?: () => void;
  title?: string;
}

export default function ASCIILogo({
  variant,
  className = '',
  alt,
  onClick,
  title,
}: ASCIILogoProps) {
  const logoConfig = {
    single: {
      src: '/images/ascii-logo-single.svg',
      width: 752,
      height: 69,
      alt: alt || 'Plant Debugger Logo',
    },
    'two-lines': {
      src: '/images/ascii-logo-two-lines.svg',
      width: 416,
      height: 149,
      alt: alt || 'Plant Debugger Logo',
    },
    plant: {
      src: '/images/ascii-plant-logo.svg',
      width: 338,
      height: 429,
      alt: alt || 'Plant ASCII Art',
    },
  } as const;

  const config = logoConfig[variant];
  const clickable = typeof onClick === 'function';

  return (
    <span
      className={`ascii-logo-wrapper ${clickable ? 'clickable' : ''}`}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (clickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      title={title}
      aria-label={title || config.alt}
    >
      <Image
        src={config.src}
        alt={config.alt}
        width={config.width}
        height={config.height}
        className={`ascii-logo-image ${variant} ${className}`}
        priority={variant !== 'plant'}
      />
    </span>
  );
}
