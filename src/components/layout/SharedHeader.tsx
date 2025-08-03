'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useScreenSize } from '@/hooks/useScreenSize';
import ASCIILogo from '@/components/ui/ASCIILogo';

interface NavigationStep {
  step: number;
  label: string;
  status: 'completed' | 'current' | 'future';
  route: string;
}

interface SharedHeaderProps {
  currentStep?: number;
  showNavigation?: boolean;
  isHomePage?: boolean;
}

export default function SharedHeader({ 
  currentStep = 0, 
  showNavigation = false,
  isHomePage = false
}: SharedHeaderProps) {
  const router = useRouter();
  const { isSmall: isSmallScreen } = useScreenSize();
  const logoRef = useRef<HTMLImageElement>(null);
  const [underlineLength, setUnderlineLength] = useState(40); // Default fallback

  // Simplified logo logic - use two-lines for home page on small screens
  const logoVariant = isHomePage && isSmallScreen ? 'two-lines' : 'single';

  // Calculate underline length based on actual logo width
  useEffect(() => {
    const calculateUnderline = () => {
      if (logoRef.current) {
        const logoWidth = logoRef.current.getBoundingClientRect().width;
        // Approximate character width in monospace font (adjusted for better fit)
        const charWidth = 7.95;
        const charCount = Math.round(logoWidth / charWidth);
        setUnderlineLength(Math.max(charCount, 15)); // Minimum 15 characters
      }
    };

    // Calculate after logo loads
    const timer = setTimeout(calculateUnderline, 100);
    
    // Recalculate on window resize
    const handleResize = () => calculateUnderline();
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [logoVariant, isSmallScreen]);

  const navigationSteps: NavigationStep[] = [
    { 
      step: 1, 
      label: 'Upload', 
      route: '/upload',
      status: currentStep === 1 ? 'current' : currentStep > 1 ? 'completed' : 'future' 
    },
    { 
      step: 2, 
      label: 'Questions', 
      route: '/questions',
      status: currentStep === 2 ? 'current' : currentStep > 2 ? 'completed' : 'future' 
    },
    { 
      step: 3, 
      label: 'Results', 
      route: '/results',
      status: currentStep === 3 ? 'current' : currentStep > 3 ? 'completed' : 'future' 
    },
  ];

  const handleStepClick = (step: NavigationStep) => {
    if (step.status === 'completed' || step.status === 'current') {
      router.push(step.route);
    }
  };

  return (
    <div className="shared-header">
      <div className="logo-section">
        <ASCIILogo 
          ref={logoRef}
          variant={logoVariant}
          className={`${logoVariant} ${isHomePage ? 'home-page' : 'other-page'}`}
        />
        <div className={`logo-underline ${logoVariant}`}>
          {'#'.repeat(underlineLength)}
        </div>
      </div>
      
      {showNavigation && (
        <div className="navigation-steps">
          {navigationSteps.map((step) => (
            <span 
              key={step.step}
              className={`nav-step nav-step--${step.status} ${
                step.status === 'completed' || step.status === 'current' ? 'clickable' : ''
              }`}
              onClick={() => handleStepClick(step)}
            >
              [{step.step}.]
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
