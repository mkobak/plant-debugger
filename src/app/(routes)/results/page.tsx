'use client';

import { useEffect, useMemo, useState } from 'react';
// Removed duplicate import of useMemo
import TerminalLayout from '@/components/layout/TerminalLayout';
import SharedHeader from '@/components/layout/SharedHeader';
import TypingText from '@/components/ui/TypingText';
import Prompt from '@/components/ui/Prompt';
import ActionButton from '@/components/ui/ActionButton';
import LoadingScreen from '@/components/ui/LoadingScreen';
import ImagePreviewGrid from '@/components/ui/ImagePreviewGrid';
import { useDiagnosis } from '@/context/DiagnosisContext';
import { useNavigation } from '@/hooks/useNavigation';
import { useDiagnosisFlow } from '@/hooks/useDiagnosisFlow';
import { exportElementToSinglePagePdf } from '@/utils/domToPdf';
import { useRef } from 'react';
import useConfirmReset from '@/hooks/useConfirmReset';

export default function ResultsPage() {
  const { goHome, goToUpload, goToQuestions } = useNavigation();
  const {
    images,
    questions,
    answers,
    additionalComments,
    plantIdentification,
    diagnosisResult: contextDiagnosisResult,
    setDiagnosisResult: setContextDiagnosisResult,
    lastDiagnosisSignature,
    setLastDiagnosisSignature,
  } = useDiagnosis();

  const [stepInitialized, setStepInitialized] = useState(false);
  const [showPrimaryDetails, setShowPrimaryDetails] = useState(false);
  const [showSecondaryDetails, setShowSecondaryDetails] = useState(false);
  const [showCare, setShowCare] = useState(false);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [isNavigatingBack, setIsNavigatingBack] = useState(false);
  const [hasShownResultsBefore, setHasShownResultsBefore] = useState(false);
  const [plantTitleDone, setPlantTitleDone] = useState(false);
  const [promptComplete, setPromptComplete] = useState(true);
  const reportRef = useRef<HTMLDivElement | null>(null);

  // Format questions and answers for the diagnosis
  const formatQuestionsAndAnswers = () => {
    const parts: string[] = [];

    // Include the identified/edited plant name on top if available
    const plantName = (plantIdentification?.name || '').trim();
    if (plantName) {
      parts.push(`Plant name: ${plantName}`);
    }

    // Only include questions that have been answered
    const answeredQuestions = questions
      .map((question: any) => {
        const answer = answers.find((a: any) => a.questionId === question.id);
        if (!answer || answer.skipped) return null;
        return `${question.question}: ${answer.answer ? 'Yes' : 'No'}`;
      })
      .filter(Boolean);

    if (answeredQuestions.length > 0) {
      if (parts.length > 0) parts.push('\n');
      parts.push(answeredQuestions.join('\n'));
    }

    // Only include additional comments if they exist and are not empty
    if (additionalComments && additionalComments.trim()) {
      if (parts.length > 0) parts.push('\n');
      parts.push(`Additional user comment: ${additionalComments.trim()}`);
    }

    return parts.length > 0
      ? parts.join('')
      : 'No additional questions were answered.';
  };

  const formatWithMarkdown = (text: string) => {
    if (!text) return '';

    const lines = text.split('\n').filter((line) => line.trim());
    const processedLines: string[] = [];
    let bulletItems: string[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.match(/^[\*\-•]\s*/)) {
        const content = trimmed.replace(/^[\*\-•]\s*/, '');
        const formattedContent = content
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/__(.*?)__/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/_(.*?)_/g, '<em>$1</em>');

        bulletItems.push(
          `<div class="custom-bullet-item"><span class="bullet-symbol">*</span><span class="bullet-content">${formattedContent}</span></div>`
        );
      } else {
        if (bulletItems.length > 0) {
          processedLines.push(
            `<div class="custom-bullet-list">${bulletItems.join('')}</div>`
          );
          bulletItems = [];
        }
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

    if (bulletItems.length > 0) {
      processedLines.push(
        `<div class="custom-bullet-list">${bulletItems.join('')}</div>`
      );
    }

    return processedLines.join('');
  };

  const questionsAndAnswers = formatQuestionsAndAnswers();

  const {
    isDiagnosing,
    initialDiagnosisComplete,
    finalDiagnosisComplete,
    diagnosisResult,
    error,
    startDiagnosis,
    resetDiagnosis,
    cancelDiagnosis,
    isReady,
  } = useDiagnosisFlow({ images, questionsAndAnswers });

  // Signatures to detect rerun conditions
  const imagesSignature = useMemo(
    () => images.map((i) => i.id).join('|'),
    [images]
  );
  const qaSignature = useMemo(() => {
    const plantName = (plantIdentification?.name || '').trim();
    const answered = questions
      .map((q: any) => {
        const a = answers.find((x: any) => x.questionId === q.id);
        return a && !a.skipped ? `${q.id}:${a.answer}` : '';
      })
      .filter(Boolean)
      .join('|');
    const comments = (additionalComments || '').trim();
    return `${plantName}|${answered}#${comments}`;
  }, [questions, answers, additionalComments, plantIdentification]);
  const diagnosisSignature = `${imagesSignature}__${qaSignature}`;
  const typingKeyPrefix = `results:${diagnosisSignature}`;
  // Reset plant title when inputs change (new analysis run)
  useEffect(() => {
    setPlantTitleDone(false);
  }, [diagnosisSignature]);

  // Set current step once
  useEffect(() => {
    if (!stepInitialized) {
      setStepInitialized(true);
    }
  }, [stepInitialized]);

  // Handle redirects and start diagnosis
  useEffect(() => {
    console.log(
      'ResultsPage: Main effect - images:',
      images.length,
      'stepInitialized:',
      stepInitialized,
      'isReady:',
      isReady,
      'diagnosisResult:',
      !!diagnosisResult,
      'contextDiagnosisResult:',
      !!contextDiagnosisResult
    );

    // Redirect if no images
    if (images.length === 0) {
      console.log('ResultsPage: No images, redirecting to upload');
      goToUpload();
      return;
    }

    // If we already have a diagnosis result in context, we're navigating back - don't restart the process
    if (contextDiagnosisResult) {
      console.log(
        'ResultsPage: Context diagnosis result already exists, skipping diagnosis'
      );
      setIsNavigatingBack(true);
      setLoadingComplete(true);
      setHasShownResultsBefore(true); // Skip typing animations when navigating back
      return;
    }

    // If we already have a diagnosis result from the hook, we're navigating back - don't restart the process
    if (diagnosisResult) {
      console.log(
        'ResultsPage: Hook diagnosis result already exists, skipping diagnosis'
      );
      setIsNavigatingBack(true);
      setLoadingComplete(true);
      setHasShownResultsBefore(true); // Skip typing animations when navigating back
      return;
    }

    // Start diagnosis if ready and step is initialized
    if (stepInitialized && isReady) {
      // If signature changed, clear previous results and rerun
      if (
        lastDiagnosisSignature &&
        lastDiagnosisSignature !== diagnosisSignature
      ) {
        console.log(
          'ResultsPage: Inputs changed, clearing previous diagnosis and restarting'
        );
        setContextDiagnosisResult(null);
        setLoadingComplete(false);
      }
      if (!contextDiagnosisResult) {
        console.log('ResultsPage: Starting diagnosis...');
        startDiagnosis();
      }
    }
  }, [
    images.length,
    stepInitialized,
    isReady,
    diagnosisResult,
    contextDiagnosisResult,
    goToUpload,
    startDiagnosis,
    lastDiagnosisSignature,
    diagnosisSignature,
    setContextDiagnosisResult,
  ]);

  // Save diagnosis result to context when it's completed
  useEffect(() => {
    if (diagnosisResult && !contextDiagnosisResult) {
      console.log('ResultsPage: Saving diagnosis result to context');
      setContextDiagnosisResult(diagnosisResult);
    }
  }, [diagnosisResult, contextDiagnosisResult, setContextDiagnosisResult]);

  // Persist the signature once we have results so we can detect back navigation vs changes later
  useEffect(() => {
    if (
      (finalDiagnosisComplete || contextDiagnosisResult) &&
      lastDiagnosisSignature !== diagnosisSignature
    ) {
      setLastDiagnosisSignature(diagnosisSignature);
    }
  }, [
    finalDiagnosisComplete,
    contextDiagnosisResult,
    diagnosisSignature,
    lastDiagnosisSignature,
    setLastDiagnosisSignature,
  ]);

  // Set hasShownResultsBefore when results first become available
  useEffect(() => {
    if (
      (finalDiagnosisComplete || contextDiagnosisResult) &&
      loadingComplete &&
      !hasShownResultsBefore
    ) {
      // Small delay to allow typing animations to finish on first visit
      const timer = setTimeout(() => {
        setHasShownResultsBefore(true);
      }, 2000); // Wait 2 seconds after loading completes
      return () => clearTimeout(timer);
    }
  }, [
    finalDiagnosisComplete,
    contextDiagnosisResult,
    loadingComplete,
    hasShownResultsBefore,
  ]);

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

  const { requestReset, ResetConfirmModal } = useConfirmReset();
  const handleNewDiagnosis = () => {
    // Reset local hook state then request global reset
    resetDiagnosis();
    setHasShownResultsBefore(false);
    requestReset();
  };

  const handleRetryDiagnosis = () => {
    // Reset diagnosis state and try again
    setLoadingComplete(false);
    setHasShownResultsBefore(false); // Reset typing animation state
    resetDiagnosis();
  };

  const handleDownload = async () => {
    if (!currentDiagnosisResult || !reportRef.current) return;
    try {
      setIsExporting(true);
      const ts = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
      const plant = (currentDiagnosisResult.plant || 'plant').replace(
        /[^a-z0-9_-]+/gi,
        '_'
      );
      // Temporarily force-open sections & adjust classes for export
      const root = reportRef.current; // now wraps images + results
      // Ensure all images inside root are loaded before snapshot
      const imgs = Array.from(
        root.querySelectorAll('img')
      ) as HTMLImageElement[];
      await Promise.all(
        imgs.map((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise((res) => {
                img.addEventListener('load', res, { once: true });
                img.addEventListener('error', res, { once: true });
              })
        )
      );
      const prevShowCare = showCare;
      const prevShowPrimaryDetails = showPrimaryDetails;
      const prevShowSecondaryDetails = showSecondaryDetails;
      if (!showCare) setShowCare(true);
      if (!showPrimaryDetails) setShowPrimaryDetails(true);
      if (currentDiagnosisResult.secondary && !showSecondaryDetails)
        setShowSecondaryDetails(true);
      // Wait for state flush
      await new Promise((r) => setTimeout(r, 50));
      root.classList.add('report-exporting');
      await exportElementToSinglePagePdf({
        element: root,
        fileName: `diagnosis-${plant}-${ts}.pdf`,
      });
      root.classList.remove('report-exporting');
      // Restore previous states
      setShowCare(prevShowCare);
      setShowPrimaryDetails(prevShowPrimaryDetails);
      setShowSecondaryDetails(prevShowSecondaryDetails);
    } catch (e) {
      console.error('Failed to generate report', e);
      alert('Failed to generate report. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Use the diagnosis result from context if available, otherwise from hook
  const currentDiagnosisResult = contextDiagnosisResult || diagnosisResult;

  const [isExporting, setIsExporting] = useState(false);

  return (
    <>
      <TerminalLayout title="Plant Debugger">
        {isExporting && (
          <div className="download-overlay">
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: '12px', fontWeight: 'bold' }}>
                Downloading report...
              </div>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>
                This may take a few seconds.
              </div>
            </div>
          </div>
        )}
        <SharedHeader
          currentStep={3}
          showNavigation={true}
          disableNavigation={isDiagnosing && !loadingComplete}
          onLogoClick={requestReset}
        />

        <div className="prompt-line">
          <Prompt path="~/results" />
        </div>
        <br />

        {/* Export root now wraps images + results so images appear in PDF */}
        <div ref={reportRef}>
          {/* Image Preview Grid shows only after prompt */}
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
                  isGeneratingTreatment={
                    initialDiagnosisComplete && !finalDiagnosisComplete
                  }
                  aggregatingComplete={initialDiagnosisComplete}
                  finalDiagnosisComplete={finalDiagnosisComplete}
                  onceKeyPrefix={typingKeyPrefix}
                  compact={true}
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
                        opacity: isDiagnosing ? 0.6 : 1,
                      }}
                    >
                      Retry Diagnosis
                    </button>
                  </div>
                </div>
              )}

              {/* Show results only when diagnosis is complete */}
              {(finalDiagnosisComplete || contextDiagnosisResult) &&
                (diagnosisResult || contextDiagnosisResult) &&
                (loadingComplete || !isDiagnosing) && (
                  <div className="diagnosis-results">
                    {/* Plant Information */}
                    {currentDiagnosisResult?.plant && (
                      <div className="result-section report-block">
                        <TypingText
                          text={`Plant name: ${currentDiagnosisResult.plant}`}
                          speed={60}
                          onceKey={`${typingKeyPrefix}|plant`}
                          onComplete={() => setPlantTitleDone(true)}
                        />
                      </div>
                    )}

                    {/* Care Tips Section - appears immediately after plant name is typed */}
                    {currentDiagnosisResult && plantTitleDone && (
                      <div className="result-section report-block">
                        <button
                          className="detail-button"
                          onClick={() => setShowCare(!showCare)}
                        >
                          {showCare ? 'Hide' : 'Show'} Care Tips
                        </button>

                        {showCare && (
                          <div
                            className="care-section"
                            style={{ marginTop: '-1px' }}
                          >
                            <div className="summary-content-title">
                              Care Tips:
                            </div>
                            <div className="summary-content">
                              <div
                                dangerouslySetInnerHTML={{
                                  __html: formatWithMarkdown(
                                    currentDiagnosisResult.careTips
                                  ),
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Visual Divider */}
                    {currentDiagnosisResult?.plant && (
                      <div className="result-section report-block">
                        <div className="section-divider"></div>
                      </div>
                    )}

                    {/* Primary Diagnosis */}
                    {currentDiagnosisResult && plantTitleDone && (
                      <div className="result-section report-block">
                        <div>{`Bug detected: ${currentDiagnosisResult.primary.condition}`}</div>
                        <div className="confidence-indicator">
                          <span className="confidence-text">
                            {'Confidence: '}
                          </span>
                          <span
                            className="confidence-value"
                            style={{
                              color: getConfidenceColor(
                                currentDiagnosisResult.primary.confidence
                              ),
                            }}
                          >
                            {currentDiagnosisResult.primary.confidence}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Primary Summary */}
                    {currentDiagnosisResult && plantTitleDone && (
                      <div className="result-section report-block">
                        <div>{'Summary:'}</div>
                        <div className="summary-content">
                          <div
                            dangerouslySetInnerHTML={{
                              __html: formatWithMarkdown(
                                currentDiagnosisResult.primary.summary
                              ),
                            }}
                          />
                        </div>
                        {/* Primary Details Button */}
                        <button
                          className="detail-button"
                          onClick={() =>
                            setShowPrimaryDetails(!showPrimaryDetails)
                          }
                        >
                          {showPrimaryDetails ? 'Collapse' : 'Expand'} Details
                        </button>

                        {/* Primary Details Section */}
                        {showPrimaryDetails && (
                          <div
                            className="detailed-section"
                            style={{ marginTop: '-1px' }}
                          >
                            <div className="diagnosis-subsection">
                              <div className="summary-content-title">
                                {'Reasoning:'}
                              </div>
                              <div className="summary-content">
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: formatWithMarkdown(
                                      currentDiagnosisResult.primary.reasoning
                                    ),
                                  }}
                                />
                              </div>
                            </div>

                            <div className="diagnosis-subsection">
                              <div className="summary-content-title">
                                {'Treatment Plan:'}
                              </div>
                              <div className="summary-content">
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: formatWithMarkdown(
                                      currentDiagnosisResult.primary.treatment
                                    ),
                                  }}
                                />
                              </div>
                            </div>

                            <div className="diagnosis-subsection">
                              <div className="summary-content-title">
                                {'Prevention Tips:'}
                              </div>
                              <div className="summary-content">
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: formatWithMarkdown(
                                      currentDiagnosisResult.primary.prevention
                                    ),
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Secondary Diagnosis */}
                    {currentDiagnosisResult?.secondary && plantTitleDone && (
                      <>
                        {/* Visual Divider */}
                        <div className="result-section report-block">
                          <div className="section-divider"></div>
                        </div>

                        <div className="result-section report-block">
                          <div>{`Another possible bug: ${currentDiagnosisResult.secondary.condition}`}</div>
                          <div className="confidence-indicator">
                            <span
                              className="confidence-text"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {'Confidence: '}
                            </span>
                            <span
                              className="confidence-value"
                              style={{
                                color: getConfidenceColor(
                                  currentDiagnosisResult.secondary.confidence
                                ),
                              }}
                            >
                              {currentDiagnosisResult.secondary.confidence}
                            </span>
                          </div>
                        </div>

                        {/* Secondary Summary */}
                        <div className="result-section report-block">
                          <div>{'Summary:'}</div>
                          <div className="summary-content">
                            <div
                              dangerouslySetInnerHTML={{
                                __html: formatWithMarkdown(
                                  currentDiagnosisResult.secondary.summary
                                ),
                              }}
                            />
                          </div>
                          {/* Secondary Details Button */}
                          <button
                            className="detail-button"
                            onClick={() =>
                              setShowSecondaryDetails(!showSecondaryDetails)
                            }
                          >
                            {showSecondaryDetails ? 'Collapse' : 'Expand'}{' '}
                            Details
                          </button>

                          {/* Secondary Details Section */}
                          {showSecondaryDetails && (
                            <div
                              className="detailed-section"
                              style={{ marginTop: '-1px' }}
                            >
                              <div className="diagnosis-subsection">
                                <div className="summary-content-title">
                                  {'Reasoning:'}
                                </div>
                                <div className="summary-content">
                                  <div
                                    dangerouslySetInnerHTML={{
                                      __html: formatWithMarkdown(
                                        currentDiagnosisResult.secondary
                                          .reasoning
                                      ),
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="diagnosis-subsection">
                                <div className="summary-content-title">
                                  {'Treatment Plan:'}
                                </div>
                                <div className="summary-content">
                                  <div
                                    dangerouslySetInnerHTML={{
                                      __html: formatWithMarkdown(
                                        currentDiagnosisResult.secondary
                                          .treatment
                                      ),
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="diagnosis-subsection">
                                <div className="summary-content-title">
                                  {'Prevention Tips:'}
                                </div>
                                <div className="summary-content">
                                  <div
                                    dangerouslySetInnerHTML={{
                                      __html: formatWithMarkdown(
                                        currentDiagnosisResult.secondary
                                          .prevention
                                      ),
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    {/* Visual Divider */}
                    <div className="result-section report-block">
                      <div className="section-divider"></div>
                    </div>
                  </div>
                )}
            </div>
            {/* /.results-page */}
          </div>
          {/* /export root */}
          {/* Cancel button shown only during loading */}
          {isDiagnosing && !loadingComplete && !error && (
            <div className="page-actions page-actions--center">
              <ActionButton
                variant="reset"
                onClick={() => {
                  // Abort and go back to questions
                  cancelDiagnosis();
                  setHasShownResultsBefore(false);
                  setLoadingComplete(false);
                  goToQuestions();
                }}
              >
                Cancel
              </ActionButton>
            </div>
          )}

          {/* Only show buttons when not loading or when there's an error */}
          {(!(isDiagnosing && !loadingComplete) || error) && (
            <div className="page-actions">
              <ActionButton
                variant="reset"
                onClick={handleNewDiagnosis}
                disabled={isDiagnosing}
              >
                Reset
              </ActionButton>

              <ActionButton
                variant="primary"
                disabled={!currentDiagnosisResult}
                onClick={handleDownload}
              >
                Download
              </ActionButton>
            </div>
          )}
        </div>
      </TerminalLayout>
      <ResetConfirmModal />
    </>
  );
}
