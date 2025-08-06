'use client';

import { useEffect, useRef, useState } from 'react';
import { useScreenSize } from '@/hooks/useScreenSize';
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
  const underlineRef = useRef<HTMLDivElement>(null);
  const navUnderlineRef = useRef<HTMLDivElement>(null);
  const [logoUnderlineChars, setLogoUnderlineChars] = useState(80);
  const [navUnderlineChars, setNavUnderlineChars] = useState(80);

  // Simplified logo logic - use two-lines for home page on small screens
  const logoVariant = isHomePage && isSmallScreen ? 'two-lines' : 'single';

  // Calculate exact number of # characters that fit in the container
  useEffect(() => {
    const calculateChars = () => {
      if (underlineRef.current) {
        const containerWidth = underlineRef.current.getBoundingClientRect().width;
        // Use a more precise character width measurement
        const tempSpan = document.createElement('span');
        tempSpan.style.fontFamily = 'monospace';
        tempSpan.style.fontSize = '0.9rem';
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.position = 'absolute';
        tempSpan.textContent = '#';
        document.body.appendChild(tempSpan);
        const charWidth = tempSpan.getBoundingClientRect().width;
        document.body.removeChild(tempSpan);

        const numChars = Math.floor(containerWidth*1.005 / charWidth);
        setLogoUnderlineChars(Math.max(numChars, 10)); // Minimum 10 characters
      }

      if (navUnderlineRef.current) {
        const containerWidth = navUnderlineRef.current.getBoundingClientRect().width;
        const tempSpan = document.createElement('span');
        tempSpan.style.fontFamily = 'monospace';
        tempSpan.style.fontSize = '0.9rem';
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.position = 'absolute';
        tempSpan.textContent = '#';
        document.body.appendChild(tempSpan);
        const charWidth = tempSpan.getBoundingClientRect().width;
        document.body.removeChild(tempSpan);
        
        const numChars = Math.floor(containerWidth*1.005 / charWidth);
        setNavUnderlineChars(Math.max(numChars, 10)); // Minimum 10 characters
      }
    };

    // Calculate after component mounts
    const timer = setTimeout(calculateChars, 50);
    
    // Recalculate on window resize
    const handleResize = () => calculateChars();
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
          variant={logoVariant}
          className={`${logoVariant} ${isHomePage ? 'home-page' : 'other-page'}`}
        />
        <div ref={underlineRef} className={`logo-underline ${logoVariant}`}>
          {'#'.repeat(logoUnderlineChars)}
        </div>
      </div>
      
      {showNavigation && (
        <div className="navigation-section">
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
                  [ {step.step}. ]
                </span>
              );
            })}
          </div>
          <div ref={navUnderlineRef} className="navigation-underline">
            {'#'.repeat(navUnderlineChars)}
          </div>
        </div>
      )}
    </div>
  );
}
