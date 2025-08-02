'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
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
  const underlineRef = useRef<HTMLDivElement>(null);

  // For small screens on home page, always start with two-line format
  // On subsequent steps, use single line format (scaled down)
  const shouldShowTwoLines = isHomePage && isSmallScreen;
  const shouldShowSingleLine = !shouldShowTwoLines;

  // Calculate underline width to match logo exactly
  useEffect(() => {
    const calculateUnderline = () => {
      // Small delay to ensure logo SVG has rendered
      setTimeout(() => {
        if (underlineRef.current) {
          const underlineElement = underlineRef.current;
          
          // Find the logo image element
          const logoImage = underlineElement.parentElement?.querySelector('.ascii-logo-image');
          
          if (logoImage) {
            // Get the actual rendered width of the SVG
            const logoWidth = logoImage.getBoundingClientRect().width;
            
            // Create a temporary element to measure actual character width
            const testElement = document.createElement('span');
            testElement.style.font = window.getComputedStyle(underlineElement).font;
            testElement.style.position = 'absolute';
            testElement.style.visibility = 'hidden';
            testElement.style.whiteSpace = 'nowrap';
            testElement.textContent = '#';
            document.body.appendChild(testElement);
            
            const actualCharWidth = testElement.getBoundingClientRect().width;
            document.body.removeChild(testElement);
            
            // Calculate the number of characters needed
            const numChars = Math.round(logoWidth / actualCharWidth);
            
            // Ensure we have a reasonable minimum (in case of measurement errors)
            const minChars = shouldShowTwoLines ? 15 : 25;
            const finalCharCount = Math.max(numChars, minChars);
            
            underlineElement.textContent = '#'.repeat(finalCharCount);
          } else {
            // Fallback if logo not found
            const numChars = shouldShowTwoLines ? 30 : 50;
            underlineElement.textContent = '#'.repeat(numChars);
          }
        }
      }, 150);
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
            <ASCIILogo 
              variant="single" 
              className={`single-line ${isHomePage ? 'home-page' : 'other-page'}`}
            />
            <div 
              ref={underlineRef}
              className={`logo-underline single-line ${isHomePage ? 'home-page' : 'other-page'}`}
            >
            </div>
          </>
        )}
        
        {shouldShowTwoLines && (
          <>
            <ASCIILogo 
              variant="two-lines" 
              className="two-lines"
            />
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
