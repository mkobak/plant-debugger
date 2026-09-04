'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import TerminalLayout from '@/components/layout/TerminalLayout';
import SharedHeader from '@/components/layout/SharedHeader';
import TypingText from '@/components/ui/TypingText';
import Prompt from '@/components/ui/Prompt';
import ActionButton from '@/components/ui/ActionButton';
import QuestionsLoadingScreen from '@/components/ui/QuestionsLoadingScreen';
import ImagePreviewGrid from '@/components/ui/ImagePreviewGrid';
import { useDiagnosis } from '@/context/DiagnosisContext';
import { useNavigation } from '@/hooks/useNavigation';
import useConfirmReset from '@/hooks/useConfirmReset';
import { getNoPlantResponse, runAnalysis } from '@/lib/api/diagnosis';

import { logger } from '@/lib/logger';
import { imagesSignature } from '@/utils';

// Page state machine for loading, content, and error
enum PageState {
  LOADING = 'loading',
  SHOWING_CONTENT = 'showing_content',
  ERROR = 'error',
}

enum LoadingPhase {
  ANALYZING = 'analyzing',
  IDENTIFYING = 'identifying',
  INITIAL_DIAGNOSIS = 'initial_diagnosis',
  GENERATING_QUESTIONS = 'generating_questions',
  COMPLETE = 'complete',
}

export default function QuestionsPage() {
  // Signature of the image set a run was started for during this mount;
  // synchronous, so it also dedupes StrictMode double-invoked effects
  const startedSignatureRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Avoid aborting on unmount to prevent React StrictMode remounts from canceling in-flight requests
  const { goHome, goToResults, goToUpload } = useNavigation();
  const {
    images,
    plantIdentification,
    setPlantIdentification,
    updatePlantName,
    questions,
    setQuestions,
    answers,
    addAnswer,
    additionalComments,
    setRawInitialDiagnoses,
    setRankedDiagnoses,
    noPlantMessage,
    setNoPlantMessage,
    lastQAImagesSignature,
    setLastQAImagesSignature,
    qaProcessingSignature,
    setQaProcessingSignature,
    setIsIdentifying: setCtxIsIdentifying,
    setIsGeneratingQuestions: setCtxIsGeneratingQuestions,
    hydrated,
  } = useDiagnosis();
  const { requestReset, ResetConfirmModal } = useConfirmReset();

  // Local UI state for loading and animation
  const [pageState, setPageState] = useState<PageState>(PageState.LOADING);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>(
    LoadingPhase.ANALYZING
  );
  const [editablePlantName, setEditablePlantName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [identifiedName, setIdentifiedName] = useState<string>('');
  const [isNavigatingBack, setIsNavigatingBack] = useState(false);
  const [plantNameTyped, setPlantNameTyped] = useState(false);
  const [instructionsTyped, setInstructionsTyped] = useState(false);

  const imgSignature = imagesSignature(images);
  // Key for typing animation session, changes when images change
  const typingSessionKey = `qa:${imgSignature}`;

  // Redirect home when there is no session — but only after the IndexedDB
  // restore has finished, so a refresh doesn't kick the user out
  useEffect(() => {
    if (!hydrated) return;
    if (images.length === 0) {
      logger.debug('No images found, redirecting home');
      goHome();
    }
  }, [hydrated, images.length, goHome]);

  // Wrapped async process to identify plant and generate questions
  const startDiagnosisProcess = useCallback(async () => {
    try {
      setPageState(PageState.LOADING);
      setLoadingPhase(LoadingPhase.ANALYZING);
      setError('');
      // Setup abort controller for this run
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      // One streamed request does identification, the consensus diagnosis,
      // the ranking and the clarifying questions; the server emits progress
      // events so the status line can advance before the payload lands
      logger.debug('Step 1: Identifying plant and diagnosing...');
      setIdentifiedName('');
      setLoadingPhase(LoadingPhase.IDENTIFYING);
      let analysis: Awaited<ReturnType<typeof runAnalysis>>;
      try {
        analysis = await runAnalysis(images, additionalComments || '', signal, {
          onIdentification: (name) => {
            setIdentifiedName(name);
            setLoadingPhase(LoadingPhase.INITIAL_DIAGNOSIS);
            setCtxIsIdentifying(false);
          },
          onProgress: (stage) => {
            if (stage === 'questions') {
              setCtxIsGeneratingQuestions(true);
              setLoadingPhase(LoadingPhase.GENERATING_QUESTIONS);
            }
          },
        });
      } finally {
        setCtxIsIdentifying(false);
        setCtxIsGeneratingQuestions(false);
      }
      const identification = analysis.identification;
      logger.debug('Plant identified:', identification);
      setPlantIdentification(identification);
      setEditablePlantName(identification.name || 'Unknown plant');

      // If no plant detected, get a message and skip questions
      if (!identification.name) {
        logger.debug('No plant detected, generating message...');
        try {
          // Only fetch once per image set
          if (!noPlantMessage) {
            const message = await getNoPlantResponse(images, signal);
            setNoPlantMessage(message);
          }
        } catch (e) {
          logger.error('Failed to get message:', e);
          setNoPlantMessage(
            '404 plant not found. Looks like our classifier threw a null pointer on foliage.'
          );
        }
        // Record signature so we know this run is complete for these images
        setLastQAImagesSignature(imagesSignature(images));
        setQaProcessingSignature(null);
        setLoadingPhase(LoadingPhase.COMPLETE);
        setPageState(PageState.SHOWING_CONTENT);
        return;
      }

      setRawInitialDiagnoses(analysis.rawDiagnoses);
      setRankedDiagnoses(analysis.rankedDiagnoses);
      logger.debug('Questions generated:', analysis.questions.length);
      setQuestions(analysis.questions);
      // Record signature so we can detect changes next time
      setLastQAImagesSignature(imagesSignature(images));
      setQaProcessingSignature(null);
      setLoadingPhase(LoadingPhase.COMPLETE);

      logger.debug('Process complete, showing content');
      // Reset all typing states when transitioning to content
      setPlantNameTyped(false);
      setInstructionsTyped(false);
      setPageState(PageState.SHOWING_CONTENT);
    } catch (error: unknown) {
      logger.error('Diagnosis process failed:', error);
      const aborted =
        (error instanceof Error && error.name === 'AbortError') ||
        (error instanceof Error &&
          error.message.toLowerCase().includes('aborted')) ||
        abortRef.current?.signal.aborted;
      if (aborted) {
        logger.debug('QuestionsPage: aborted by user');
        setCtxIsIdentifying(false);
        setCtxIsGeneratingQuestions(false);
        setQaProcessingSignature(null);
        setLastQAImagesSignature(null);
        startedSignatureRef.current = null;
        return;
      }
      setError(
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
      setPageState(PageState.ERROR);
      // Keep startedSignatureRef set so the start effect does not auto-retry
      // in a loop; the Retry button re-triggers the run explicitly.
      setQaProcessingSignature(null);
    }
  }, [
    images,
    noPlantMessage,
    setCtxIsGeneratingQuestions,
    setCtxIsIdentifying,
    setLastQAImagesSignature,
    setNoPlantMessage,
    setPlantIdentification,
    setQaProcessingSignature,
    setQuestions,
    additionalComments,
    setRawInitialDiagnoses,
    setRankedDiagnoses,
  ]);

  // Restore prior state on back-navigation, or start the QA run
  useEffect(() => {
    if (!hydrated) return;
    const imgSig = imagesSignature(images);
    // If images changed since the last completed run, the flow must rerun
    const signatureChanged =
      !!lastQAImagesSignature && lastQAImagesSignature !== imgSig;
    const startedThisMount = startedSignatureRef.current === imgSig;

    // Restore state if navigating back and data is present
    if (!signatureChanged && !startedThisMount) {
      if (questions.length > 0 && plantIdentification) {
        logger.debug('QuestionsPage: restoring state (navigation back)');
        setIsNavigatingBack(true);
        setEditablePlantName(plantIdentification.name || '');
        setPlantNameTyped(true);
        setInstructionsTyped(true);
        setPageState(PageState.SHOWING_CONTENT);
        return;
      }
      if (noPlantMessage) {
        logger.debug('QuestionsPage: restoring no-plant state');
        setIsNavigatingBack(true);
        setPageState(PageState.SHOWING_CONTENT);
        return;
      }
    }

    // Start the run unless it already ran or is running for these images
    const alreadyCompleted =
      !signatureChanged && lastQAImagesSignature === imgSig;
    const alreadyRunning = qaProcessingSignature === imgSig;
    if (
      images.length === 0 ||
      startedThisMount ||
      alreadyCompleted ||
      alreadyRunning
    ) {
      return;
    }

    logger.debug('QuestionsPage: starting identification/questions run');
    startedSignatureRef.current = imgSig;
    // Clear old data if images changed
    if (signatureChanged) {
      setPlantIdentification(null);
      setQuestions([]);
      setNoPlantMessage('');
      setPageState(PageState.LOADING);
    }
    setCtxIsIdentifying(true);
    setQaProcessingSignature(imgSig);
    startDiagnosisProcess();
  }, [
    hydrated,
    questions.length,
    plantIdentification,
    images,
    lastQAImagesSignature,
    qaProcessingSignature,
    noPlantMessage,
    startDiagnosisProcess,
    setCtxIsIdentifying,
    setNoPlantMessage,
    setPlantIdentification,
    setQaProcessingSignature,
    setQuestions,
  ]);

  useEffect(() => {
    return () => {
      setCtxIsIdentifying(false);
      setCtxIsGeneratingQuestions(false);
    };
  }, [setCtxIsIdentifying, setCtxIsGeneratingQuestions]);

  const handleAnswer = (questionId: string, answer: boolean) => {
    addAnswer({ questionId, answer, skipped: false });
  };

  const getAnswerById = (questionId: string) =>
    answers.find((a) => a.questionId === questionId);

  const handleReset = () => {
    requestReset();
  };

  const handleNext = () => {
    goToResults();
  };

  const canProceed =
    (pageState === PageState.SHOWING_CONTENT && !noPlantMessage) ||
    pageState === PageState.ERROR;

  // Loading state calculations for the loading screen
  const isIdentifying = loadingPhase === LoadingPhase.IDENTIFYING;
  const isInvestigating = loadingPhase === LoadingPhase.INITIAL_DIAGNOSIS;
  const isGeneratingQuestions =
    loadingPhase === LoadingPhase.GENERATING_QUESTIONS;
  const identificationComplete =
    loadingPhase === LoadingPhase.INITIAL_DIAGNOSIS ||
    loadingPhase === LoadingPhase.GENERATING_QUESTIONS ||
    loadingPhase === LoadingPhase.COMPLETE;
  const questionsGenerated = loadingPhase === LoadingPhase.COMPLETE;

  return (
    <>
      <TerminalLayout title="Plant Debugger">
        <SharedHeader
          currentStep={2}
          showNavigation={true}
          disableNavigation={pageState === PageState.LOADING}
          onLogoClick={requestReset}
        />

        {/* Images show immediately now */}
        {images.length > 0 && (
          <div className="page-images">
            <ImagePreviewGrid images={images} />
          </div>
        )}

        {/* Prompt only during loading, below images and above status/loading screen */}
        {pageState === PageState.LOADING && (
          <>
            <div className="prompt-line">
              <Prompt path="~/analysis" />
            </div>
          </>
        )}

        <div className="questions-page">
          <div className="terminal-text">
            {/* Show loading screen while processing */}
            {pageState === PageState.LOADING && (
              <QuestionsLoadingScreen
                isIdentifying={isIdentifying}
                isInvestigating={isInvestigating}
                isGeneratingQuestions={isGeneratingQuestions}
                identificationComplete={identificationComplete}
                questionsGenerated={questionsGenerated}
                identifiedName={identifiedName}
                onceKeyPrefix={typingSessionKey}
                compact={true}
                onComplete={() => {
                  if (loadingPhase === LoadingPhase.COMPLETE) {
                    setPageState(PageState.SHOWING_CONTENT);
                  }
                }}
              />
            )}
            {pageState === PageState.LOADING && (
              <div className="page-actions page-actions--center">
                <ActionButton
                  variant="reset"
                  onClick={() => {
                    // Abort and go back to upload
                    startedSignatureRef.current = null;
                    if (abortRef.current) abortRef.current.abort();
                    setQaProcessingSignature(null);
                    setLastQAImagesSignature(null);
                    setCtxIsIdentifying(false);
                    setCtxIsGeneratingQuestions(false);
                    setQuestions([]);
                    setPlantIdentification(null);
                    setNoPlantMessage('');
                    goToUpload();
                  }}
                >
                  Cancel
                </ActionButton>
              </div>
            )}

            {/* Show error message */}
            {error && (
              <div className="error-message">
                <TypingText text={`Error: ${error}`} speed={100} />
                <div className="error-actions">
                  <button
                    onClick={() => {
                      startedSignatureRef.current = imagesSignature(images);
                      setQaProcessingSignature(imagesSignature(images));
                      startDiagnosisProcess();
                    }}
                    className="retry-button"
                  >
                    Retry
                  </button>
                  <button onClick={handleReset} className="reset-button">
                    Reset
                  </button>
                </div>
              </div>
            )}

            {/* Show no-plant message if applicable */}
            {pageState === PageState.SHOWING_CONTENT && noPlantMessage && (
              <div className="no-plant-message-title">
                <TypingText
                  text={'Error detecting plant'}
                  speed={100}
                  onceKey={`${typingSessionKey}|no-plant-label`}
                />
                <div className="no-plant-message-text">
                  <TypingText
                    text={noPlantMessage}
                    speed={120}
                    onceKey={`${typingSessionKey}|no-plant-message-title`}
                  />
                </div>
              </div>
            )}

            {/* Show plant identification and questions when ready */}
            {pageState === PageState.SHOWING_CONTENT &&
              plantIdentification &&
              !noPlantMessage && (
                <div className="plant-identification">
                  {!isNavigatingBack ? (
                    <TypingText
                      text={`Plant name:`}
                      speed={100}
                      onceKey={`${typingSessionKey}|plant-label`}
                      onComplete={() => {
                        logger.debug('Plant name typing complete');
                        setPlantNameTyped(true);
                      }}
                    />
                  ) : (
                    <div>Plant name:</div>
                  )}
                  {(plantNameTyped || isNavigatingBack) && (
                    <div className="plant-name-container">
                      <span className="plant-name-label"> </span>
                      <input
                        type="text"
                        value={editablePlantName}
                        onChange={(e) => {
                          setEditablePlantName(e.target.value);
                          updatePlantName(e.target.value);
                        }}
                        className="plant-name-input"
                        placeholder="Unknown"
                      />
                    </div>
                  )}
                </div>
              )}

            {pageState === PageState.SHOWING_CONTENT &&
              !noPlantMessage &&
              questions.length > 0 &&
              (plantNameTyped || isNavigatingBack) && (
                <div className="questions-section">
                  {!isNavigatingBack ? (
                    <TypingText
                      text="Please answer the following questions (optional):"
                      speed={100}
                      onceKey={`${typingSessionKey}|instructions`}
                      onComplete={() => {
                        logger.debug('Instructions typing complete');
                        setInstructionsTyped(true);
                      }}
                    />
                  ) : (
                    <div>Please answer the following questions (optional):</div>
                  )}

                  {(instructionsTyped || isNavigatingBack) &&
                    questions.map((question, index) => {
                      const existing = getAnswerById(question.id);
                      return (
                        <div key={question.id} className="question-item">
                          <div>
                            Q{index + 1}: {question.question}
                          </div>
                          <div className="question-buttons no-clear">
                            <div className="answer-buttons-group">
                              <button
                                className={`answer-button ${existing?.answer === true ? 'selected' : ''}`}
                                onClick={() => handleAnswer(question.id, true)}
                              >
                                [Y] Yes
                              </button>
                              <button
                                className={`answer-button ${existing && existing.answer === false && !existing.skipped ? 'selected' : ''}`}
                                onClick={() => handleAnswer(question.id, false)}
                              >
                                [N] No
                              </button>
                              <button
                                className={`answer-button ${existing?.skipped ? 'selected' : ''}`}
                                onClick={() => {
                                  addAnswer({
                                    questionId: question.id,
                                    answer: false,
                                    skipped: true,
                                  });
                                }}
                              >
                                [S] Skip
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

            {pageState === PageState.SHOWING_CONTENT &&
              !noPlantMessage &&
              questions.length === 0 &&
              (plantNameTyped || isNavigatingBack) && (
                <div className="no-questions">
                  <TypingText
                    text="No additional questions needed. Proceeding to diagnosis..."
                    speed={100}
                  />
                </div>
              )}
          </div>

          {/* Only show buttons when content is displayed or there's an error */}
          {(pageState === PageState.SHOWING_CONTENT ||
            pageState === PageState.ERROR) && (
            <div className="page-actions">
              <ActionButton variant="reset" onClick={handleReset}>
                Reset
              </ActionButton>

              <ActionButton
                variant="primary"
                href="/results"
                disabled={!canProceed}
                className={canProceed ? 'has-images' : ''}
                onClick={handleNext}
              >
                Debug
              </ActionButton>
            </div>
          )}
        </div>
      </TerminalLayout>
      <ResetConfirmModal />
    </>
  );
}
