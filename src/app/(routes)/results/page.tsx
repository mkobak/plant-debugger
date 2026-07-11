'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import TerminalLayout from '@/components/layout/TerminalLayout';
import SharedHeader from '@/components/layout/SharedHeader';
import TypingText from '@/components/ui/TypingText';
import Prompt from '@/components/ui/Prompt';
import ActionButton from '@/components/ui/ActionButton';
import LoadingScreen from '@/components/ui/LoadingScreen';
import ImagePreviewGrid from '@/components/ui/ImagePreviewGrid';
import DiagnosisSection from '@/components/results/DiagnosisSection';
import CareTips from '@/components/results/CareTips';
import { useDiagnosis } from '@/context/DiagnosisContext';
import { useNavigation } from '@/hooks/useNavigation';
import { useDiagnosisFlow } from '@/hooks/useDiagnosisFlow';
import { useResultsExport } from '@/hooks/useResultsExport';
import useConfirmReset from '@/hooks/useConfirmReset';
import { imagesSignature, hashString } from '@/utils';
import { formatReportAsMarkdown } from '@/utils/reportText';
import { saveHistoryEntry, makeThumbnail } from '@/lib/history';
import { DiagnosticQuestion, DiagnosisResult } from '@/types';
import { logger } from '@/lib/logger';

export default function ResultsPage() {
  const { goToUpload, goToQuestions } = useNavigation();
  const {
    images,
    questions,
    answers,
    additionalComments,
    plantIdentification,
    rankedDiagnoses,
    lastDiagnosisSignature,
    setLastDiagnosisSignature,
  } = useDiagnosis();

  const [stepInitialized, setStepInitialized] = useState(false);
  const [showPrimaryDetails, setShowPrimaryDetails] = useState(false);
  const [showSecondaryDetails, setShowSecondaryDetails] = useState(false);
  const [showCare, setShowCare] = useState(false);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [hasShownResultsBefore, setHasShownResultsBefore] = useState(false);
  const [plantTitleDone, setPlantTitleDone] = useState(false);
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
      .map((question: DiagnosticQuestion) => {
        const answer = answers.find((a) => a.questionId === question.id);
        if (!answer || answer.skipped) return null;
        return `${question.question}: ${answer.answer ? 'Yes' : 'No'}`;
      })
      .filter(Boolean);

    if (answeredQuestions.length > 0) {
      if (parts.length > 0) parts.push('\n');
      parts.push(answeredQuestions.join('\n'));
    }

    return parts.length > 0
      ? parts.join('')
      : 'No additional questions were answered.';
  };

  const questionsAndAnswers = formatQuestionsAndAnswers();

  const {
    isDiagnosing,
    initialDiagnosisComplete,
    finalDiagnosisComplete,
    diagnosisResult,
    partialDiagnosis,
    error,
    startDiagnosis,
    resetDiagnosis,
    cancelDiagnosis,
    isReady,
  } = useDiagnosisFlow({
    images,
    questionsAndAnswers,
    rankedDiagnoses,
    userComment: additionalComments,
  });

  // Signatures to detect rerun conditions
  const imgSignature = useMemo(() => imagesSignature(images), [images]);
  const qaSignature = useMemo(() => {
    const plantName = (plantIdentification?.name || '').trim();
    const answered = questions
      .map((q) => {
        const a = answers.find((x) => x.questionId === q.id);
        return a && !a.skipped ? `${q.id}:${a.answer}` : '';
      })
      .filter(Boolean)
      .join('|');
    const comments = (additionalComments || '').trim();
    return `${plantName}|${answered}#${comments}`;
  }, [questions, answers, additionalComments, plantIdentification]);
  const diagnosisSignature = `${imgSignature}__${qaSignature}`;
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
    // Redirect if no images
    if (images.length === 0) {
      logger.debug('ResultsPage: No images, redirecting to upload');
      goToUpload();
      return;
    }

    // A result already in context means we're navigating back — don't rerun
    if (diagnosisResult) {
      setLoadingComplete(true);
      setHasShownResultsBefore(true); // Skip typing animations
      return;
    }

    // Start diagnosis if ready and step is initialized
    if (stepInitialized && isReady) {
      // If signature changed, clear previous results and rerun
      if (
        lastDiagnosisSignature &&
        lastDiagnosisSignature !== diagnosisSignature
      ) {
        logger.debug(
          'ResultsPage: Inputs changed, clearing previous diagnosis and restarting'
        );
        setLoadingComplete(false);
      }
      logger.debug('ResultsPage: Starting diagnosis...');
      startDiagnosis();
    }
  }, [
    images.length,
    stepInitialized,
    isReady,
    diagnosisResult,
    goToUpload,
    startDiagnosis,
    lastDiagnosisSignature,
    diagnosisSignature,
  ]);

  // Render results as soon as the data arrives — don't gate on the
  // status-line typing animation finishing
  useEffect(() => {
    if (finalDiagnosisComplete) {
      setLoadingComplete(true);
    }
  }, [finalDiagnosisComplete]);

  // Record any completed diagnosis in the local history — fresh runs AND
  // results restored from a previous session (which predate the history
  // feature or were completed before navigating away). The entry id derives
  // from the diagnosis signature, so repeated saves are idempotent.
  const historySavedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!diagnosisResult) return;
    if (historySavedRef.current === diagnosisSignature) return;
    historySavedRef.current = diagnosisSignature;
    (async () => {
      const thumbnail = images[0]?.file
        ? await makeThumbnail(images[0].file)
        : null;
      await saveHistoryEntry({
        id: `h-${hashString(diagnosisSignature)}`,
        createdAt: Date.now(),
        plant: diagnosisResult.plant || plantIdentification?.name || 'Unknown',
        diagnosisResult,
        thumbnail,
      });
    })();
  }, [diagnosisResult, diagnosisSignature, images, plantIdentification]);

  // Persist the signature once we have results so we can detect back navigation vs changes later
  useEffect(() => {
    if (
      (finalDiagnosisComplete || diagnosisResult) &&
      lastDiagnosisSignature !== diagnosisSignature
    ) {
      setLastDiagnosisSignature(diagnosisSignature);
    }
  }, [
    finalDiagnosisComplete,
    diagnosisResult,
    diagnosisSignature,
    lastDiagnosisSignature,
    setLastDiagnosisSignature,
  ]);

  // Set hasShownResultsBefore when results first become available
  useEffect(() => {
    if (diagnosisResult && loadingComplete && !hasShownResultsBefore) {
      // Small delay to allow typing animations to finish on first visit
      const timer = setTimeout(() => {
        setHasShownResultsBefore(true);
      }, 300);
      return () => clearTimeout(timer);
    }
    // Allow re-typing after the result is cleared (e.g. reset or changed inputs)
    if (!diagnosisResult && hasShownResultsBefore) {
      setHasShownResultsBefore(false);
    }
  }, [diagnosisResult, loadingComplete, hasShownResultsBefore]);

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

  const [copied, setCopied] = useState(false);
  const handleCopyReport = async () => {
    if (!diagnosisResult) return;
    try {
      await navigator.clipboard.writeText(
        formatReportAsMarkdown(diagnosisResult)
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      logger.warn('Copy to clipboard failed', e);
    }
  };

  const { isExporting, handleDownload } = useResultsExport({
    reportRef,
    diagnosisResult,
    expandAllSections: () => {
      const prevShowCare = showCare;
      const prevShowPrimaryDetails = showPrimaryDetails;
      const prevShowSecondaryDetails = showSecondaryDetails;
      setShowCare(true);
      setShowPrimaryDetails(true);
      if (diagnosisResult?.secondary) setShowSecondaryDetails(true);
      return () => {
        setShowCare(prevShowCare);
        setShowPrimaryDetails(prevShowPrimaryDetails);
        setShowSecondaryDetails(prevShowSecondaryDetails);
      };
    },
  });

  // While the final diagnosis streams, assemble a partial result from the
  // completed fields so sections appear as they finish generating
  type DisplayResult = Omit<DiagnosisResult, 'primary'> & {
    primary: DiagnosisResult['primary'] | null;
  };
  const displayResult: DisplayResult | null = useMemo(() => {
    if (diagnosisResult) return diagnosisResult;
    const f = partialDiagnosis;
    if (!f?.plant) return null;
    return {
      plant: f.plant,
      primary:
        f.primaryDiagnosis && f.primaryConfidence && f.primarySummary
          ? {
              condition: f.primaryDiagnosis,
              confidence: f.primaryConfidence as 'High' | 'Medium' | 'Low',
              summary: f.primarySummary,
              reasoning: f.primaryReasoning || '',
              treatment: f.primaryTreatmentPlan || '',
              prevention: f.primaryPreventionTips || '',
            }
          : null,
      ...(f.secondaryDiagnosis && f.secondaryConfidence && f.secondarySummary
        ? {
            secondary: {
              condition: f.secondaryDiagnosis,
              confidence: f.secondaryConfidence as 'High' | 'Medium' | 'Low',
              summary: f.secondarySummary,
              reasoning: f.secondaryReasoning || '',
              treatment: f.secondaryTreatmentPlan || '',
              prevention: f.secondaryPreventionTips || '',
            },
          }
        : {}),
      careTips: f.careTips || '',
    };
  }, [diagnosisResult, partialDiagnosis]);
  const isStreaming = !diagnosisResult && !!displayResult;

  const sectionDivider = (
    <div className="result-section report-block">
      <div className="section-divider"></div>
    </div>
  );

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

        {/* Export root wraps images + results so images appear in PDF */}
        <div ref={reportRef}>
          {/* Image Preview Grid always first */}
          {images.length > 0 && (
            <div className="page-images">
              <ImagePreviewGrid images={images} />
            </div>
          )}

          {/* Prompt only during diagnosing (loading), below images and above status/loading screen */}
          {isDiagnosing && !loadingComplete && !isStreaming && (
            <div className="prompt-line">
              <Prompt path="~/results" />
            </div>
          )}

          <div className="results-page">
            <div className="terminal-text">
              {/* Show loading screen while diagnosing */}
              {isDiagnosing && !loadingComplete && !isStreaming && (
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
                  <TypingText text={`> Error: ${error}`} speed={100} />
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
                        fontSize: '14px',
                        opacity: isDiagnosing ? 0.6 : 1,
                      }}
                    >
                      Retry Diagnosis
                    </button>
                  </div>
                </div>
              )}

              {/* Results: streamed sections appear as fields complete */}
              {displayResult &&
                (isStreaming || loadingComplete || !isDiagnosing) && (
                  <div className="diagnosis-results">
                    {/* Plant Information */}
                    {displayResult.plant && (
                      <div className="result-section report-block">
                        <TypingText
                          text={`Plant name: ${displayResult.plant}`}
                          speed={100}
                          onceKey={`${typingKeyPrefix}|plant`}
                          onComplete={() => setPlantTitleDone(true)}
                        />
                      </div>
                    )}

                    {/* Care Tips - last field to stream in */}
                    {plantTitleDone && displayResult.careTips && (
                      <CareTips
                        careTips={displayResult.careTips}
                        expanded={showCare}
                        onToggle={() => setShowCare(!showCare)}
                      />
                    )}

                    {displayResult.plant && plantTitleDone && sectionDivider}

                    {/* Primary Diagnosis */}
                    {plantTitleDone && displayResult.primary && (
                      <DiagnosisSection
                        title="Bug detected:"
                        diagnosis={displayResult.primary}
                        expanded={showPrimaryDetails}
                        onToggle={() =>
                          setShowPrimaryDetails(!showPrimaryDetails)
                        }
                        detailsReady={
                          !isStreaming ||
                          !!partialDiagnosis?.primaryPreventionTips
                        }
                      />
                    )}

                    {/* Secondary Diagnosis */}
                    {displayResult.secondary && plantTitleDone && (
                      <>
                        {sectionDivider}
                        <DiagnosisSection
                          title="Another possible bug:"
                          diagnosis={displayResult.secondary}
                          expanded={showSecondaryDetails}
                          onToggle={() =>
                            setShowSecondaryDetails(!showSecondaryDetails)
                          }
                          detailsReady={
                            !isStreaming ||
                            !!partialDiagnosis?.secondaryPreventionTips
                          }
                        />
                      </>
                    )}

                    {plantTitleDone && !isStreaming && sectionDivider}
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
                variant="reset"
                disabled={!diagnosisResult}
                onClick={handleCopyReport}
              >
                {copied ? 'Copied!' : 'Copy'}
              </ActionButton>

              <ActionButton
                variant="primary"
                disabled={!diagnosisResult}
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
