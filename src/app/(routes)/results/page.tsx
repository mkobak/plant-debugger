'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TerminalLayout from '@/components/layout/TerminalLayout';
import SharedHeader from '@/components/layout/SharedHeader';
import TypingText from '@/components/ui/TypingText';
import ActionButton from '@/components/ui/ActionButton';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useDiagnosis } from '@/context/DiagnosisContext';
import { useDiagnosisFlow } from '@/hooks/useDiagnosisFlow';

export default function ResultsPage() {
  const router = useRouter();
  const {
    images,
    setCurrentStep,
    questions,
    answers,
    resetDiagnosis: resetGlobalDiagnosis
  } = useDiagnosis();

  const [stepInitialized, setStepInitialized] = useState(false);
  const [line1Complete, setLine1Complete] = useState(false);
  const [line2Complete, setLine2Complete] = useState(false);
  const [line3Complete, setLine3Complete] = useState(false);
  const [showDetailed, setShowDetailed] = useState(false);
  const [showCare, setShowCare] = useState(false);

  // Format questions and answers for the diagnosis
  const formatQuestionsAndAnswers = () => {
    if (questions.length === 0 || answers.length === 0) {
      return 'No additional questions were answered.';
    }

    return questions.map(question => {
      const answer = answers.find(a => a.questionId === question.id);
      if (!answer) return '';
      
      if (answer.skipped) {
        return `${question.question}: Skipped`;
      }
      return `${question.question}: ${answer.answer ? 'Yes' : 'No'}`;
    }).filter(Boolean).join('\n');
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
    console.log('ResultsPage: Main effect - images:', images.length, 'stepInitialized:', stepInitialized, 'isReady:', isReady);
    
    // Redirect if no images
    if (images.length === 0) {
      console.log('ResultsPage: No images, redirecting to upload');
      router.push('/upload');
      return;
    }

    // Start diagnosis if ready and step is initialized
    if (stepInitialized && isReady && !diagnosisResult) {
      console.log('ResultsPage: Starting diagnosis...');
      startDiagnosis();
    }
  }, [images.length, stepInitialized, isReady, diagnosisResult, router, startDiagnosis]);

  const getConfidenceColor = (confidence: 'High' | 'Medium' | 'Low') => {
    if (confidence === 'High') return 'var(--green)';
    if (confidence === 'Medium') return 'var(--yellow)';
    return 'var(--red)';
  };

  const handleNewDiagnosis = () => {
    resetGlobalDiagnosis();
    router.push('/');
  };

  const handleRetryDiagnosis = () => {
    // Reset diagnosis state and try again
    resetDiagnosis();
  };

  return (
    <TerminalLayout title="plant-debugger:~/results$">
      <SharedHeader currentStep={3} showNavigation={true} />
      
      <div className="results-page">
        <div className="terminal-text">
          <TypingText
            text="> Processing diagnosis..."
            speed={60}
            onComplete={() => setLine1Complete(true)}
          />
          
          {line1Complete && (
            <div className="terminal-line">
              <TypingText
                text="> Aggregating multi-model responses"
                speed={60}
                delay={1000}
                onComplete={() => setLine2Complete(true)}
              />
              {isDiagnosing && !initialDiagnosisComplete && <LoadingSpinner />}
            </div>
          )}
          
          {line2Complete && (
            <div className="terminal-line">
              <TypingText
                text="> Generating comprehensive treatment plan"
                speed={60}
                delay={2000}
                onComplete={() => setLine3Complete(true)}
              />
              {isDiagnosing && initialDiagnosisComplete && !finalDiagnosisComplete && <LoadingSpinner />}
            </div>
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

          {finalDiagnosisComplete && diagnosisResult && (
            <div className="diagnosis-results">
              <br />
              <TypingText 
                text="> Diagnosis Complete!"
                speed={80}
              />
              <br />

              {/* Plant Information */}
              {diagnosisResult.plant && (
                <div className="result-section">
                  <TypingText text={`> Plant: ${diagnosisResult.plant}`} speed={60} />
                </div>
              )}

              {/* Primary Diagnosis */}
              <div className="result-section">
                <TypingText 
                  text={`> Primary Diagnosis: ${diagnosisResult.primary.condition}`}
                  speed={60}
                />
                <div className="confidence-indicator">
                  <span 
                    className="confidence-text"
                    style={{ color: getConfidenceColor(diagnosisResult.primary.confidence) }}
                  >
                    Confidence: {diagnosisResult.primary.confidence}
                  </span>
                </div>
              </div>

              {/* Executive Summary */}
              <div className="result-section">
                <TypingText text="> Executive Summary:" speed={60} />
                <div className="summary-content">
                  {diagnosisResult.summary}
                </div>
              </div>

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
              {showDetailed && (
                <div className="detailed-section">
                  <h3>Detailed Diagnosis</h3>
                  
                  {diagnosisResult.reasoning && (
                    <div className="diagnosis-subsection">
                      <h4>Reasoning:</h4>
                      <div 
                        className="markdown-content"
                        dangerouslySetInnerHTML={{ __html: diagnosisResult.reasoning.replace(/\n/g, '<br>') }}
                      />
                    </div>
                  )}
                  
                  <div className="diagnosis-subsection">
                    <h4>Treatment Plan:</h4>
                    <div 
                      className="markdown-content"
                      dangerouslySetInnerHTML={{ __html: diagnosisResult.treatment.replace(/\n/g, '<br>') }}
                    />
                  </div>
                  
                  <div className="diagnosis-subsection">
                    <h4>Prevention Tips:</h4>
                    <div 
                      className="markdown-content"
                      dangerouslySetInnerHTML={{ __html: diagnosisResult.prevention.replace(/\n/g, '<br>') }}
                    />
                  </div>
                </div>
              )}

              {/* Care Tips */}
              {showCare && (
                <div className="care-section">
                  <h3>General Care Tips</h3>
                  <div 
                    className="markdown-content"
                    dangerouslySetInnerHTML={{ __html: diagnosisResult.careTips.replace(/\n/g, '<br>') }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="page-actions">
          <ActionButton 
            variant="secondary"
            href="/questions"
            disabled={isDiagnosing}
          >
            [ Back to Questions ]
          </ActionButton>
          
          <ActionButton 
            variant="reset"
            onClick={handleNewDiagnosis}
            disabled={isDiagnosing}
          >
            [ New Diagnosis ]
          </ActionButton>
        </div>
      </div>
    </TerminalLayout>
  );
}
