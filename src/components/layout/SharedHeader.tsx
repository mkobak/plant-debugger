'use client';

import { useScreenSize } from '@/hooks/useScreenSize';
import { useNavigation } from '@/hooks/useNavigation';
import { useDiagnosis } from '@/context/DiagnosisContext';
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
  disableNavigation?: boolean;
  onLogoClick?: () => void;
}

export default function SharedHeader({
  currentStep = 0,
  showNavigation = false,
  isHomePage = false,
  disableNavigation = false,
  onLogoClick,
}: SharedHeaderProps) {
  const { isSmall: isSmallScreen } = useScreenSize();
  const { goToUpload, goToQuestions, goToResults } = useNavigation();
  const { images, diagnosisResult } = useDiagnosis();

  // Use two-lines for home page on small screens
  const logoVariant = isHomePage && isSmallScreen ? 'two-lines' : 'single';

  const navigationSteps: NavigationStep[] = [
    { step: 1, label: 'Upload', route: '/upload' },
    { step: 2, label: 'Analysis', route: '/analysis' },
    { step: 3, label: 'Results', route: '/results' },
  ];

  const canGoToStep = (stepNum: number) => {
    if (disableNavigation) return false;
    if (stepNum === 1) return true;
    if (stepNum === 2) return images.length > 0; // Only after images are present
    if (stepNum === 3) return !!diagnosisResult; // Only after diagnosis completed
    return false;
  };

  const handleStepClick = (step: NavigationStep) => {
    if (canGoToStep(step.step)) {
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
    if (canGoToStep(step)) return 'completed';
    return 'future';
  };

  return (
    <div className="shared-header">
      <div className="logo-section">
        <ASCIILogo
          variant={logoVariant}
          className={`${logoVariant} ${isHomePage ? 'home-page' : 'other-page'}`}
          onClick={onLogoClick}
          title={onLogoClick ? 'Home' : undefined}
        />
        <div className={`logo-underline ${logoVariant}`} aria-hidden="true" />
      </div>

      {showNavigation && (
        <div className="navigation-section terminal-status-bar">
          <div className="terminal-status-line">
            {navigationSteps.map((step, idx) => {
              const status = getStepStatus(step.step);
              const isDisabled = disableNavigation || status === 'future';
              const label = step.label.toLowerCase();
              return (
                <span
                  key={step.step}
                  className={`status-segment status-segment--${status}`}
                >
                  <button
                    type="button"
                    className={`status-segment-button ${!isDisabled ? 'clickable' : ''}`}
                    onClick={() => handleStepClick(step)}
                    disabled={isDisabled}
                    aria-current={status === 'current' ? 'step' : undefined}
                  >
                    {status === 'current' ? '[' + label + ']' : label}
                  </button>
                  {idx < navigationSteps.length - 1 && (
                    <span className="status-arrow">→</span>
                  )}
                </span>
              );
            })}
          </div>
          <div className="logo-underline" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
