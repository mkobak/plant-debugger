import React from 'react';

interface ASCIILogoProps {
  variant: 'single' | 'two-lines' | 'plant';
  className?: string;
  alt?: string;
}

export default function ASCIILogo({ variant, className = '', alt }: ASCIILogoProps) {
  const logoConfig = {
    single: {
      src: '/images/ascii-logo-single.svg',
      width: 752,
      height: 69,
      alt: alt || 'Plant Debugger Logo'
    },
    'two-lines': {
      src: '/images/ascii-logo-two-lines.svg',
      width: 416,
      height: 149,
      alt: alt || 'Plant Debugger Logo'
    },
    plant: {
      src: '/images/ascii-plant-logo.svg',
      width: 338,
      height: 429,
      alt: alt || 'Plant ASCII Art'
    }
  };

  const config = logoConfig[variant];

  return (
    <img
      src={config.src}
      alt={config.alt}
      className={`ascii-logo-image ${variant} ${className}`}
    />
  );
}
