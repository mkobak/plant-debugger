'use client';

import { useEffect, useState } from 'react';
import TerminalLayout from '@/components/layout/TerminalLayout';
import SharedHeader from '@/components/layout/SharedHeader';
import TypingText from '@/components/ui/TypingText';
import ActionButton from '@/components/ui/ActionButton';
import LoadingScreen from '@/components/ui/LoadingScreen';
import ImagePreviewGrid from '@/components/ui/ImagePreviewGrid';
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
    additionalComments,
    diagnosisResult: contextDiagnosisResult,
    setDiagnosisResult: setContextDiagnosisResult,
  } = useDiagnosis();

  const [stepInitialized, setStepInitialized] = useState(false);
  const [showPrimaryDetails, setShowPrimaryDetails] = useState(false);
  const [showSecondaryDetails, setShowSecondaryDetails] = useState(false);
  const [showCare, setShowCare] = useState(false);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [isNavigatingBack, setIsNavigatingBack] = useState(false);
  const [hasShownResultsBefore, setHasShownResultsBefore] = useState(false);

  // Format questions and answers for the diagnosis
  const formatQuestionsAndAnswers = () => {
    const parts: string[] = [];
    
    // Only include questions that have been answered
    const answeredQuestions = questions
      .map((question: any) => {
        const answer = answers.find((a: any) => a.questionId === question.id);
        if (!answer || answer.skipped) return null;
        return `${question.question}: ${answer.answer ? 'Yes' : 'No'}`;
      })
      .filter(Boolean);
    
    if (answeredQuestions.length > 0) {
      parts.push(answeredQuestions.join('\n'));
    }
    
    // Only include additional comments if they exist and are not empty
    if (additionalComments && additionalComments.trim()) {
      if (parts.length > 0) {
        parts.push('\n');
      }
      parts.push(`Additional user comment: ${additionalComments.trim()}`);
    }
    
    return parts.length > 0 ? parts.join('') : 'No additional questions were answered.';
  };

  const formatWithMarkdown = (text: string) => {
    if (!text) return '';
    
    // First, handle bullet points BEFORE doing other markdown processing
    // This prevents asterisks from being converted to <em> tags
    const lines = text.split('\n').filter(line => line.trim());
    const processedLines: string[] = [];
    let bulletItems: string[] = [];
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      // Check for bullet points (including asterisks at the beginning of lines)
      if (trimmed.match(/^[\*\-•]\s*/)) {
        // Remove the bullet character and process the content for markdown
        const content = trimmed.replace(/^[\*\-•]\s*/, '');
        // Apply markdown formatting to the bullet content
        const formattedContent = content
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/__(.*?)__/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/_(.*?)_/g, '<em>$1</em>');
        
        bulletItems.push(`<div class="custom-bullet-item"><span class="bullet-symbol">*</span><span class="bullet-content">${formattedContent}</span></div>`);
      } else {
        // If we have accumulated bullet items, wrap them and add them
        if (bulletItems.length > 0) {
          processedLines.push(`<div class="custom-bullet-list">${bulletItems.join('')}</div>`);
          bulletItems = [];
        }
        // Add regular paragraph with markdown formatting
        if (trimmed) {
          const formattedParagraph = trimmed
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.*?)__/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/_(.*?)_/g, '<em>$1</em>');
          processedLines.push(`<p>${formattedParagraph}</p>`);
        }
      }
    });
    
    // Handle any remaining bullet items at the end
    if (bulletItems.length > 0) {
      processedLines.push(`<div class="custom-bullet-list">${bulletItems.join('')}</div>`);
    }
    
    return processedLines.join('');
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
      setHasShownResultsBefore(true); // Skip typing animations when navigating back
      return;
    }

    // If we already have a diagnosis result from the hook, we're navigating back - don't restart the process
    if (diagnosisResult) {
      console.log('ResultsPage: Hook diagnosis result already exists, skipping diagnosis');
      setIsNavigatingBack(true);
      setLoadingComplete(true);
      setHasShownResultsBefore(true); // Skip typing animations when navigating back
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

  // Set hasShownResultsBefore when results first become available
  useEffect(() => {
    if ((finalDiagnosisComplete || contextDiagnosisResult) && loadingComplete && !hasShownResultsBefore) {
      // Small delay to allow typing animations to finish on first visit
      const timer = setTimeout(() => {
        setHasShownResultsBefore(true);
      }, 2000); // Wait 2 seconds after loading completes
      return () => clearTimeout(timer);
    }
  }, [finalDiagnosisComplete, contextDiagnosisResult, loadingComplete, hasShownResultsBefore]);

  // Reset hook state if context diagnosis result is cleared (e.g., after reset)
  useEffect(() => {
    if (!contextDiagnosisResult && diagnosisResult) {
      console.log('ResultsPage: Context was reset, resetting hook state');
      resetDiagnosis();
    }
    // Also reset typing animation flag when context is cleared
    if (!contextDiagnosisResult && !diagnosisResult) {
      setHasShownResultsBefore(false);
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
    setHasShownResultsBefore(false); // Reset typing animation state
    goHome();
  };

  const handleRetryDiagnosis = () => {
    // Reset diagnosis state and try again
    setLoadingComplete(false);
    setHasShownResultsBefore(false); // Reset typing animation state
    resetDiagnosis();
  };

  // Use the diagnosis result from context if available, otherwise from hook
  const currentDiagnosisResult = contextDiagnosisResult || diagnosisResult;

  // Component to conditionally show typing text or instant text
  const ConditionalTypingText = ({ text, speed = 60 }: { text: string; speed?: number }) => {
    if (hasShownResultsBefore) {
      return <span>{text}</span>;
    }
    return <TypingText text={text} speed={speed} />;
  };

  return (
    <TerminalLayout title="plant-debugger:~/results$">
      <SharedHeader currentStep={3} showNavigation={true} />
      
      {/* Image Preview Grid */}
      {images.length > 0 && (
        <div className="page-images">
          <ImagePreviewGrid images={images} />
        </div>
      )}
      
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
              {/* Plant Information */}
              {currentDiagnosisResult?.plant && (
                <div className="result-section">
                  <ConditionalTypingText text={`> Plant: ${currentDiagnosisResult.plant}`} speed={60} />
                </div>
              )}

              {/* Care Tips Section - Right after plant name */}
              {currentDiagnosisResult && (
                <div className="result-section">
                  <button 
                    className="detail-button"
                    onClick={() => setShowCare(!showCare)}
                  >
                    {showCare ? 'Hide' : 'Show'} Care Tips
                  </button>
                  
                  {showCare && (
                    <div className="care-section" style={{ marginTop: '-1px' }}>
                       {'> Care Tips:'} 
                      <div className="summary-content">
                        <div 
                          dangerouslySetInnerHTML={{ 
                            __html: formatWithMarkdown(currentDiagnosisResult.careTips)
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Visual Divider */}
              {currentDiagnosisResult?.plant && (
                <div className="result-section">
                  <div className="section-divider"></div>
                </div>
              )}

              {/* Primary Diagnosis */}
              {currentDiagnosisResult && (
                <div className="result-section">
                  <ConditionalTypingText 
                    text={`> Bug detected: ${currentDiagnosisResult.primary.condition}`}
                    speed={60}
                  />
                  <div className="confidence-indicator">
                    <span className="confidence-text">
                      {'> Confidence: '} 
                    </span>
                    <span 
                      className="confidence-value"
                      style={{ color: getConfidenceColor(currentDiagnosisResult.primary.confidence) }}
                    >
                      {currentDiagnosisResult.primary.confidence}
                    </span>
                  </div>
                </div>
              )}

              {/* Primary Summary */}
              {currentDiagnosisResult && (
                <div className="result-section">
                  <ConditionalTypingText text="> Summary:" speed={60} />
                  <div className="summary-content">
                    <div 
                      dangerouslySetInnerHTML={{ 
                        __html: formatWithMarkdown(currentDiagnosisResult.primary.summary)
                      }}
                    />
                  </div>
                  
                  {/* Primary Details Button */}
                  <button 
                    className="detail-button"
                    onClick={() => setShowPrimaryDetails(!showPrimaryDetails)}
                  >
                    {showPrimaryDetails ? 'Collapse' : 'Expand'} Details
                  </button>
                  
                  {/* Primary Details Section */}
                  {showPrimaryDetails && (
                    <div className="detailed-section" style={{ marginTop: '-1px' }}>
                      <div className="diagnosis-subsection">
                        {'> Reasoning:'}
                        <div className="summary-content">
                          <div 
                            dangerouslySetInnerHTML={{ 
                              __html: formatWithMarkdown(currentDiagnosisResult.primary.reasoning)
                            }}
                          />
                        </div>
                      </div>
                      
                      <div className="diagnosis-subsection">
                        {'> Treatment Plan:'}
                        <div className="summary-content">
                          <div 
                            dangerouslySetInnerHTML={{ 
                              __html: formatWithMarkdown(currentDiagnosisResult.primary.treatment)
                            }}
                          />
                        </div>
                      </div>
                      
                      <div className="diagnosis-subsection">
                        {'> Prevention Tips:'}
                        <div className="summary-content">
                          <div 
                            dangerouslySetInnerHTML={{ 
                              __html: formatWithMarkdown(currentDiagnosisResult.primary.prevention)
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Secondary Diagnosis */}
              {currentDiagnosisResult?.secondary && (
                <>
                  {/* Visual Divider */}
                  <div className="result-section">
                    <div className="section-divider"></div>
                  </div>

                  <div className="result-section">
                    <ConditionalTypingText 
                      text={`> Alternative possible bug: ${currentDiagnosisResult.secondary.condition}`}
                      speed={60}
                    />
                    <div className="confidence-indicator">
                      <span className="confidence-text" style={{ color: 'var(--text-primary)' }}>
                        {'> Confidence: '} 
                      </span>
                      <span 
                        className="confidence-value"
                        style={{ color: getConfidenceColor(currentDiagnosisResult.secondary.confidence) }}
                      >
                        {currentDiagnosisResult.secondary.confidence}
                      </span>
                    </div>
                  </div>

                  {/* Secondary Summary */}
                  <div className="result-section">
                    <ConditionalTypingText text="> Summary:" speed={60} />
                    <div className="summary-content">
                      <div 
                        dangerouslySetInnerHTML={{ 
                          __html: formatWithMarkdown(currentDiagnosisResult.secondary.summary)
                        }}
                      />
                    </div>
                    
                    {/* Secondary Details Button */}
                    <button 
                      className="detail-button"
                      onClick={() => setShowSecondaryDetails(!showSecondaryDetails)}
                    >
                      {showSecondaryDetails ? 'Collapse' : 'Expand'} Details
                    </button>
                    
                    {/* Secondary Details Section */}
                    {showSecondaryDetails && (
                      <div className="detailed-section" style={{ marginTop: '-1px' }}>
                        <div className="diagnosis-subsection">
                          {'> Reasoning:'}
                          <div className="summary-content">
                            <div 
                              dangerouslySetInnerHTML={{ 
                                __html: formatWithMarkdown(currentDiagnosisResult.secondary.reasoning)
                              }}
                            />
                          </div>
                        </div>
                        
                        <div className="diagnosis-subsection">
                          {'> Treatment Plan:'}
                          <div className="summary-content">
                            <div 
                              dangerouslySetInnerHTML={{ 
                                __html: formatWithMarkdown(currentDiagnosisResult.secondary.treatment)
                              }}
                            />
                          </div>
                        </div>
                        
                        <div className="diagnosis-subsection">
                          {'> Prevention Tips:'}
                          <div className="summary-content">
                            <div 
                              dangerouslySetInnerHTML={{ 
                                __html: formatWithMarkdown(currentDiagnosisResult.secondary.prevention)
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
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
