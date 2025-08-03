'use client';

import { useEffect, useRef, useState } from 'react';
import { useScreenSize } from '@/hooks/useScreenSize';
import { useDiagnosis } from '@/context/DiagnosisContext';
import { useNavigation } from '@/hooks/useNavigation';
import ASCIILogo from '@/components/ui/ASCIILogo';

interface NavigationStep {
  step: number;
  label: string;
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
  const { isSmall: isSmallScreen } = useScreenSize();
  const { canNavigateToStep, goToUpload, goToQuestions, goToResults } = useNavigation();
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
    { step: 1, label: 'Upload', route: '/upload' },
    { step: 2, label: 'Questions', route: '/questions' },
    { step: 3, label: 'Results', route: '/results' },
  ];

  const handleStepClick = (step: NavigationStep) => {
    if (canNavigateToStep(step.step)) {
      switch (step.step) {
        case 1:
          goToUpload();
          break;
        case 2:
          goToQuestions();
          break;
        case 3:
          goToResults();
          break;
      }
    }
  };

  const getStepStatus = (step: number) => {
    if (step === currentStep) return 'current';
    if (canNavigateToStep(step)) return 'completed';
    return 'future';
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
          {navigationSteps.map((step) => {
            const status = getStepStatus(step.step);
            return (
              <span 
                key={step.step}
                className={`nav-step nav-step--${status} ${
                  status === 'completed' || status === 'current' ? 'clickable' : ''
                }`}
                onClick={() => handleStepClick(step)}
              >
                [{step.step}.]
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
