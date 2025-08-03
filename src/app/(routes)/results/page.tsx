'use client';

import { useEffect, useState } from 'react';
import TerminalLayout from '@/components/layout/TerminalLayout';
import SharedHeader from '@/components/layout/SharedHeader';
import TypingText from '@/components/ui/TypingText';
import ActionButton from '@/components/ui/ActionButton';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { useDiagnosis } from '@/context/DiagnosisContext';
import { useNavigation } from '@/hooks/useNavigation';
import { useDiagnosisFlow } from '@/hooks/useDiagnosisFlow';

export default function ResultsPage() {
  const { goHome, goToUpload, maxReachedStep } = useNavigation();
  const {
    images,
    setCurrentStep,
    questions,
    answers,
    diagnosisResult: contextDiagnosisResult,
    setDiagnosisResult: setContextDiagnosisResult,
  } = useDiagnosis();

  const [stepInitialized, setStepInitialized] = useState(false);
  const [showDetailed, setShowDetailed] = useState(false);
  const [showCare, setShowCare] = useState(false);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [isNavigatingBack, setIsNavigatingBack] = useState(false);

  // Format questions and answers for the diagnosis
  const formatQuestionsAndAnswers = () => {
    if (questions.length === 0 || answers.length === 0) {
      return 'No additional questions were answered.';
    }

    return questions.map((question: any) => {
      const answer = answers.find((a: any) => a.questionId === question.id);
      if (!answer) return '';
      
      if (answer.skipped) {
        return `${question.question}: Skipped`;
      }
      return `${question.question}: ${answer.answer ? 'Yes' : 'No'}`;
    }).filter(Boolean).join('\n');
  };

  const formatAsBulletPoints = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    const bulletItems: string[] = [];
    const regularLines: string[] = [];
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
        bulletItems.push(trimmed.replace(/^[-•]\s*/, ''));
      } else {
        regularLines.push(trimmed);
      }
    });
    
    let formatted = '';
    if (regularLines.length > 0) {
      formatted += regularLines.map(line => `<p>${line}</p>`).join('');
    }
    if (bulletItems.length > 0) {
      formatted += '<ul>' + bulletItems.map(item => `<li>${item}</li>`).join('') + '</ul>';
    }
    
    return formatted;
  };

  const questionsAndAnswers = formatQuestionsAndAnswers();

  // Use the new diagnosis flow hook
  const {
    isDiagnosing,
    initialDiagnosisComplete,
    finalDiagnosisComplete,
    diagnosisResult,
    error,
    startDiagnosis,
    resetDiagnosis,
    isReady
  } = useDiagnosisFlow({ images, questionsAndAnswers });

  // Set current step once
  useEffect(() => {
    if (!stepInitialized) {
      setCurrentStep(3);
      setStepInitialized(true);
    }
  }, [setCurrentStep, stepInitialized]);

  // Handle redirects and start diagnosis
  useEffect(() => {
    console.log('ResultsPage: Main effect - images:', images.length, 'stepInitialized:', stepInitialized, 'isReady:', isReady, 'diagnosisResult:', !!diagnosisResult, 'contextDiagnosisResult:', !!contextDiagnosisResult);
    
    // Redirect if no images
    if (images.length === 0) {
      console.log('ResultsPage: No images, redirecting to upload');
      goToUpload();
      return;
    }

    // If we already have a diagnosis result in context, we're navigating back - don't restart the process
    if (contextDiagnosisResult) {
      console.log('ResultsPage: Context diagnosis result already exists, skipping diagnosis');
      setIsNavigatingBack(true);
      setLoadingComplete(true);
      return;
    }

    // If we already have a diagnosis result from the hook, we're navigating back - don't restart the process
    if (diagnosisResult) {
      console.log('ResultsPage: Hook diagnosis result already exists, skipping diagnosis');
      setIsNavigatingBack(true);
      setLoadingComplete(true);
      return;
    }

    // Start diagnosis if ready and step is initialized
    if (stepInitialized && isReady && !diagnosisResult && !contextDiagnosisResult) {
      console.log('ResultsPage: Starting diagnosis...');
      startDiagnosis();
    }
  }, [images.length, stepInitialized, isReady, diagnosisResult, contextDiagnosisResult, goToUpload, startDiagnosis]);

  // Save diagnosis result to context when it's completed
  useEffect(() => {
    if (diagnosisResult && !contextDiagnosisResult) {
      console.log('ResultsPage: Saving diagnosis result to context');
      setContextDiagnosisResult(diagnosisResult);
    }
  }, [diagnosisResult, contextDiagnosisResult, setContextDiagnosisResult]);

  // Reset hook state if context diagnosis result is cleared (e.g., after reset)
  useEffect(() => {
    if (!contextDiagnosisResult && diagnosisResult) {
      console.log('ResultsPage: Context was reset, resetting hook state');
      resetDiagnosis();
    }
  }, [contextDiagnosisResult, diagnosisResult, resetDiagnosis]);

  const getConfidenceColor = (confidence: 'High' | 'Medium' | 'Low') => {
    if (confidence === 'High') return 'var(--green)';
    if (confidence === 'Medium') return 'var(--orange)';
    return 'var(--red)';
  };

  const handleNewDiagnosis = () => {
    // Reset the diagnosis flow hook state before going home
    resetDiagnosis();
    goHome();
  };

  const handleRetryDiagnosis = () => {
    // Reset diagnosis state and try again
    setLoadingComplete(false);
    resetDiagnosis();
  };

  // Use the diagnosis result from context if available, otherwise from hook
  const currentDiagnosisResult = contextDiagnosisResult || diagnosisResult;

  return (
    <TerminalLayout title="plant-debugger:~/results$">
      <SharedHeader currentStep={3} showNavigation={true} />
      
      <div className="results-page">
        <div className="terminal-text">
          {/* Show loading screen while diagnosing */}
          {isDiagnosing && !loadingComplete && (
            <LoadingScreen 
              isDiagnosing={isDiagnosing}
              isAggregating={!initialDiagnosisComplete}
              isGeneratingTreatment={initialDiagnosisComplete && !finalDiagnosisComplete}
              aggregatingComplete={initialDiagnosisComplete}
              finalDiagnosisComplete={finalDiagnosisComplete}
              onComplete={() => setLoadingComplete(true)} 
            />
          )}

          {error && (
            <div className="error-message">
              <TypingText text={`> Error: ${error}`} speed={80} />
              <div className="error-actions" style={{ marginTop: '10px' }}>
                <button 
                  className="retry-button"
                  onClick={handleRetryDiagnosis}
                  disabled={isDiagnosing}
                  style={{
                    background: 'var(--red)',
                    color: 'var(--bg-primary)',
                    border: 'none',
                    padding: '8px 16px',
                    cursor: isDiagnosing ? 'not-allowed' : 'pointer',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    opacity: isDiagnosing ? 0.6 : 1
                  }}
                >
                  [ Retry Diagnosis ]
                </button>
              </div>
            </div>
          )}

          {/* Show results only when diagnosis is complete */}
          {(finalDiagnosisComplete || contextDiagnosisResult) && (diagnosisResult || contextDiagnosisResult) && (loadingComplete || !isDiagnosing) && (
            <div className="diagnosis-results">
              <br />
              {!isNavigatingBack ? (
                <TypingText 
                  text="> Diagnosis Complete!"
                  speed={80}
                />
              ) : (
                <div>&gt; Diagnosis Complete!</div>
              )}
              <br />

              {/* Plant Information */}
              {currentDiagnosisResult?.plant && (
                <div className="result-section">
                  <TypingText text={`> Plant: ${currentDiagnosisResult.plant}`} speed={60} />
                </div>
              )}

              {/* Primary Diagnosis */}
              {currentDiagnosisResult && (
                <div className="result-section">
                  <TypingText 
                    text={`> Primary Diagnosis: ${currentDiagnosisResult.primary.condition}`}
                    speed={60}
                  />
                  <div className="confidence-indicator">
                    <span 
                      className="confidence-text"
                      style={{ color: getConfidenceColor(currentDiagnosisResult.primary.confidence) }}
                    >
                      Confidence: {currentDiagnosisResult.primary.confidence}
                    </span>
                  </div>
                </div>
              )}

              {/* Primary Summary */}
              {currentDiagnosisResult && (
                <div className="result-section">
                  <TypingText text="> Primary Summary:" speed={60} />
                  <div className="summary-content">
                    <div 
                      dangerouslySetInnerHTML={{ 
                        __html: formatAsBulletPoints(currentDiagnosisResult.primary.summary)
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Secondary Diagnosis */}
              {currentDiagnosisResult?.secondary && (
                <>
                  <div className="result-section">
                    <TypingText 
                      text={`> Secondary Diagnosis: ${currentDiagnosisResult.secondary.condition}`}
                      speed={60}
                    />
                    <div className="confidence-indicator">
                      <span 
                        className="confidence-text"
                        style={{ color: getConfidenceColor(currentDiagnosisResult.secondary.confidence) }}
                      >
                        Confidence: {currentDiagnosisResult.secondary.confidence}
                      </span>
                    </div>
                  </div>

                  {/* Secondary Summary */}
                  <div className="result-section">
                    <TypingText text="> Secondary Summary:" speed={60} />
                    <div className="summary-content">
                      <div 
                        dangerouslySetInnerHTML={{ 
                          __html: formatAsBulletPoints(currentDiagnosisResult.secondary.summary)
                        }}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="result-actions">
                <button 
                  className="detail-button"
                  onClick={() => setShowDetailed(!showDetailed)}
                >
                  [ {showDetailed ? 'Hide' : 'Show'} Detailed Diagnosis ]
                </button>
                
                <button 
                  className="detail-button"
                  onClick={() => setShowCare(!showCare)}
                >
                  [ {showCare ? 'Hide' : 'Show'} Care Tips ]
                </button>
              </div>

              {/* Detailed Diagnosis */}
              {showDetailed && currentDiagnosisResult && (
                <div className="detailed-section">
                  <h3>Detailed Diagnosis</h3>
                  
                  {/* Primary Diagnosis Details */}
                  <div className="diagnosis-subsection">
                    <h4>Primary Diagnosis - Reasoning:</h4>
                    <div 
                      className="markdown-content"
                      dangerouslySetInnerHTML={{ __html: currentDiagnosisResult.primary.reasoning.replace(/\n/g, '<br>') }}
                    />
                  </div>
                  
                  <div className="diagnosis-subsection">
                    <h4>Primary Diagnosis - Treatment Plan:</h4>
                    <div 
                      className="markdown-content"
                      dangerouslySetInnerHTML={{ __html: currentDiagnosisResult.primary.treatment.replace(/\n/g, '<br>') }}
                    />
                  </div>
                  
                  <div className="diagnosis-subsection">
                    <h4>Primary Diagnosis - Prevention Tips:</h4>
                    <div 
                      className="markdown-content"
                      dangerouslySetInnerHTML={{ __html: currentDiagnosisResult.primary.prevention.replace(/\n/g, '<br>') }}
                    />
                  </div>

                  {/* Secondary Diagnosis Details */}
                  {currentDiagnosisResult.secondary && (
                    <>
                      <div className="diagnosis-subsection">
                        <h4>Secondary Diagnosis - Reasoning:</h4>
                        <div 
                          className="markdown-content"
                          dangerouslySetInnerHTML={{ __html: currentDiagnosisResult.secondary.reasoning.replace(/\n/g, '<br>') }}
                        />
                      </div>
                      
                      <div className="diagnosis-subsection">
                        <h4>Secondary Diagnosis - Treatment Plan:</h4>
                        <div 
                          className="markdown-content"
                          dangerouslySetInnerHTML={{ __html: currentDiagnosisResult.secondary.treatment.replace(/\n/g, '<br>') }}
                        />
                      </div>
                      
                      <div className="diagnosis-subsection">
                        <h4>Secondary Diagnosis - Prevention Tips:</h4>
                        <div 
                          className="markdown-content"
                          dangerouslySetInnerHTML={{ __html: currentDiagnosisResult.secondary.prevention.replace(/\n/g, '<br>') }}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Care Tips */}
              {showCare && currentDiagnosisResult && (
                <div className="care-section">
                  <h3>General Care Tips</h3>
                  <div 
                    className="markdown-content"
                    dangerouslySetInnerHTML={{ __html: currentDiagnosisResult.careTips.replace(/\n/g, '<br>') }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="page-actions">
          <ActionButton 
            variant="reset"
            onClick={handleNewDiagnosis}
            disabled={isDiagnosing}
          >
            [ Reset ]
          </ActionButton>
          
          <ActionButton 
            variant="primary"
            disabled={true}
            className="placeholder-button"
          >
            [ Download ]
          </ActionButton>
        </div>
      </div>
    </TerminalLayout>
  );
}
