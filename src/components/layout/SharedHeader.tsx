'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { ASCII_LOGO_SINGLE, ASCII_LOGO_TWO_LINES } from '@/lib/constants';
import { useScreenSize } from '@/hooks/useScreenSize';

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
  const logoRef = useRef<HTMLPreElement>(null);
  const underlineRef = useRef<HTMLDivElement>(null);

  // For small screens on home page, always start with two-line format
  // On subsequent steps, use single line format (scaled down)
  const shouldShowTwoLines = isHomePage && isSmallScreen;
  const shouldShowSingleLine = !shouldShowTwoLines;

  // Calculate underline width to match logo exactly
  useEffect(() => {
    const calculateUnderline = () => {
      // Small delay to ensure logo has rendered
      setTimeout(() => {
        if (logoRef.current && underlineRef.current) {
          const logoWidth = logoRef.current.offsetWidth;
          const underlineElement = underlineRef.current;
          
          // Create a temporary element to measure the width of a single '#' character
          // using the fixed font size (1rem) that we set in CSS
          const tempSpan = document.createElement('span');
          tempSpan.style.fontFamily = 'monospace';
          tempSpan.style.fontSize = '1rem';
          tempSpan.style.visibility = 'hidden';
          tempSpan.style.position = 'absolute';
          tempSpan.style.whiteSpace = 'nowrap';
          tempSpan.textContent = '#';
          document.body.appendChild(tempSpan);
          
          const charWidth = tempSpan.offsetWidth;
          const numChars = Math.floor(logoWidth / charWidth);
          
          // Ensure we have at least one character and don't exceed reasonable limits
          const finalNumChars = Math.max(1, Math.min(numChars, 200));
          underlineElement.textContent = '#'.repeat(finalNumChars);
          
          document.body.removeChild(tempSpan);
        }
      }, 10);
    };

    // Calculate initially
    calculateUnderline();
    
    // Recalculate on window resize with debouncing
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(calculateUnderline, 100);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [shouldShowTwoLines, isSmallScreen]);

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
        {shouldShowSingleLine && (
          <>
            <pre 
              ref={logoRef}
              className={`ascii-logo-single ${isHomePage ? 'home-page' : 'other-page'}`}
            >
{ASCII_LOGO_SINGLE}
            </pre>
            <div 
              ref={underlineRef}
              className={`logo-underline single-line ${isHomePage ? 'home-page' : 'other-page'}`}
            >
            </div>
          </>
        )}
        
        {shouldShowTwoLines && (
          <>
            <pre 
              ref={logoRef}
              className="ascii-logo-two-lines"
            >
{ASCII_LOGO_TWO_LINES}
            </pre>
            <div 
              ref={underlineRef}
              className="logo-underline two-lines"
            >
            </div>
          </>
        )}
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
