'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import {
  identifyPlant,
  generateQuestions,
  getNoPlantResponse,
} from '@/lib/api/diagnosis';

// Prevent duplicate QA runs across React StrictMode remounts
const qaRunLocks = new Set<string>();

// Page state machine for loading, content, and error
enum PageState {
  LOADING = 'loading',
  SHOWING_CONTENT = 'showing_content',
  ERROR = 'error',
}

enum LoadingPhase {
  ANALYZING = 'analyzing',
  IDENTIFYING = 'identifying',
  GENERATING_QUESTIONS = 'generating_questions',
  COMPLETE = 'complete',
}

export default function QuestionsPage() {
  const router = useRouter();
  const processStartedRef = useRef(false);
  const initialRenderRef = useRef(true);
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
    removeAnswer,
    additionalComments,
    setAdditionalComments,
    noPlantMessage,
    setNoPlantMessage,
    lastQAImagesSignature,
    setLastQAImagesSignature,
    qaProcessingSignature,
    setQaProcessingSignature,
    isIdentifying: ctxIsIdentifying,
    setIsIdentifying: setCtxIsIdentifying,
    isGeneratingQuestions: ctxIsGeneratingQuestions,
    setIsGeneratingQuestions: setCtxIsGeneratingQuestions,
  } = useDiagnosis();
  const { requestReset, ResetConfirmModal } = useConfirmReset();

  // Local UI state for loading and animation
  const [pageState, setPageState] = useState<PageState>(PageState.LOADING);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>(
    LoadingPhase.ANALYZING
  );
  const [editablePlantName, setEditablePlantName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isNavigatingBack, setIsNavigatingBack] = useState(false);
  const [plantNameTyped, setPlantNameTyped] = useState(false);
  const [instructionsTyped, setInstructionsTyped] = useState(false);
  const [commentsLabelTyped, setCommentsLabelTyped] = useState(false);
  const [promptComplete, setPromptComplete] = useState(true); // prompt and content render immediately

  const computeImagesSignature = useCallback(
    () => images.map((i) => i.id).join('|'),
    [images]
  );
  const imagesSignature = computeImagesSignature();
  // Key for typing animation session, changes when images change
  const typingSessionKey = `qa:${imagesSignature}`;

  // On mount: redirect to home if no images are present
  useEffect(() => {
    console.log('QuestionsPage mounting');
    // Redirect if no images are present
    if (images.length === 0) {
      const timeout = setTimeout(() => {
        console.log('No images found, redirecting to home');
        goHome();
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [images.length, router, goHome]);

  // Wrapped async process to identify plant and generate questions
  const startDiagnosisProcess = useCallback(async () => {
    try {
      setPageState(PageState.LOADING);
      setLoadingPhase(LoadingPhase.ANALYZING);
      setError('');
      // Setup abort controller for this run
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      // Step 1: Identify plant
      console.log('Step 1: Identifying plant...');
      setLoadingPhase(LoadingPhase.IDENTIFYING);
      // identifying flag already set true before calling this
      const identification = await identifyPlant(images, signal);
      setCtxIsIdentifying(false);
      if (!identification) throw new Error('Failed to identify plant');
      console.log('Plant identified:', identification);
      setPlantIdentification(identification);
      setEditablePlantName(identification.name || 'Unknown plant');

      // If no plant detected, get a message and skip questions
      if (!identification.name) {
        console.log('No plant detected, generating message...');
        try {
          // Only fetch once per image set
          if (!noPlantMessage) {
            const message = await getNoPlantResponse(images, signal);
            setNoPlantMessage(message);
          }
        } catch (e) {
          console.error('Failed to get message:', e);
          setNoPlantMessage(
            '404 plant not found. Looks like our classifier threw a null pointer on foliage.'
          );
        }
        // Record signature so we know this run is complete for these images
        const imgSig = computeImagesSignature();
        setLastQAImagesSignature(imgSig);
        setQaProcessingSignature(null);
        qaRunLocks.delete(imgSig);
        setLoadingPhase(LoadingPhase.COMPLETE);
        setPageState(PageState.SHOWING_CONTENT);
        setCtxIsGeneratingQuestions(false);
        return;
      }

      // Step 2: Generate questions
      console.log('Step 2: Generating questions...');
      setLoadingPhase(LoadingPhase.GENERATING_QUESTIONS);
      setCtxIsGeneratingQuestions(true);
      const generatedQuestions = await generateQuestions(images, signal);
      setCtxIsGeneratingQuestions(false);
      console.log('Questions generated:', generatedQuestions.length);
      setQuestions(generatedQuestions);
      // Record signature so we can detect changes next time
      const imgSig = computeImagesSignature();
      setLastQAImagesSignature(imgSig);
      // Release lock now that this run finished
      qaRunLocks.delete(imgSig);
      setLoadingPhase(LoadingPhase.COMPLETE);

      // Show content after a brief delay
      setTimeout(() => {
        console.log('Process complete, showing content');
        // Reset all typing states when transitioning to content
        setPlantNameTyped(false);
        setInstructionsTyped(false);
        setCommentsLabelTyped(false);
        setPageState(PageState.SHOWING_CONTENT);
      }, 500);
    } catch (error: any) {
      console.error('Diagnosis process failed:', error);
      const aborted =
        (error instanceof Error && error.name === 'AbortError') ||
        (typeof error?.message === 'string' &&
          error.message.toLowerCase().includes('aborted')) ||
        abortRef.current?.signal.aborted;
      if (aborted) {
        console.log('QuestionsPage: aborted by user');
        setCtxIsIdentifying(false);
        setCtxIsGeneratingQuestions(false);
        const imgSig = computeImagesSignature();
        qaRunLocks.delete(imgSig);
        processStartedRef.current = false;
        return;
      }
      setError(
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
      setPageState(PageState.ERROR);
      const imgSig = computeImagesSignature();
      qaRunLocks.delete(imgSig);
      processStartedRef.current = false;
    }
  }, [
    computeImagesSignature,
    images,
    noPlantMessage,
    setCtxIsGeneratingQuestions,
    setCtxIsIdentifying,
    setLastQAImagesSignature,
    setNoPlantMessage,
    setPlantIdentification,
    setQaProcessingSignature,
    setQuestions,
  ]);

  // Detect navigation back and restore state if possible
  useEffect(() => {
    console.log('Navigation check useEffect triggered');
    console.log('- questions.length:', questions.length);
    console.log('- plantIdentification:', !!plantIdentification);
    console.log('- pageState:', pageState);
    console.log('- processStartedRef.current:', processStartedRef.current);

    const imgSig = computeImagesSignature();

    // If images changed, rerun the QA flow
    const signatureChanged =
      !!lastQAImagesSignature && lastQAImagesSignature !== imgSig;

    // Restore state if navigating back and data is present
    if (
      !signatureChanged &&
      questions.length > 0 &&
      plantIdentification &&
      !processStartedRef.current
    ) {
      console.log('DETECTING NAVIGATION BACK - setting states');
      setIsNavigatingBack(true);
      setEditablePlantName(plantIdentification.name || '');
      setPlantNameTyped(true);
      setInstructionsTyped(true);
      setCommentsLabelTyped(true);
      setPageState(PageState.SHOWING_CONTENT);
      return;
    }

    // Restore state if previously detected no-plant for these images
    if (!signatureChanged && noPlantMessage && !processStartedRef.current) {
      console.log(
        'DETECTING NAVIGATION BACK (no-plant) - restoring content without rerun'
      );
      setIsNavigatingBack(true);
      setPageState(PageState.SHOWING_CONTENT);
      return;
    }

    // Start the identification and question generation process if not already started
    if (
      images.length > 0 &&
      (signatureChanged ||
        (!processStartedRef.current &&
          pageState === PageState.LOADING &&
          !ctxIsIdentifying &&
          !ctxIsGeneratingQuestions)) &&
      // Skip if already completed for this signature
      (signatureChanged || lastQAImagesSignature !== imgSig) &&
      // Skip if a run for this signature is already in progress (StrictMode safety)
      qaProcessingSignature !== imgSig &&
      // Extra guard: global lock for remounts
      !qaRunLocks.has(imgSig)
    ) {
      console.log('Starting identification and question generation process');
      processStartedRef.current = true;
      // Clear old data if signature changed
      if (signatureChanged) {
        setPlantIdentification(null);
        setQuestions([]);
        setNoPlantMessage('');
        setPageState(PageState.LOADING);
      }
      // Mark as identifying to guard against duplicate starts
      setCtxIsIdentifying(true);
      setQaProcessingSignature(imgSig);
      // Acquire global lock synchronously
      qaRunLocks.add(imgSig);
      startDiagnosisProcess();
    }
  }, [
    questions.length,
    plantIdentification,
    pageState,
    images.length,
    lastQAImagesSignature,
    qaProcessingSignature,
    ctxIsIdentifying,
    ctxIsGeneratingQuestions,
    noPlantMessage,
    computeImagesSignature,
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
      processStartedRef.current = false;
    };
  }, [setCtxIsIdentifying, setCtxIsGeneratingQuestions]);

  const handleAnswer = (questionId: string, answer: boolean) => {
    addAnswer({ questionId, answer, skipped: false });
  };

  const getAnswerById = (questionId: string) =>
    answers.find((a: any) => a.questionId === questionId);

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
  const isGeneratingQuestions =
    loadingPhase === LoadingPhase.GENERATING_QUESTIONS;
  const identificationComplete =
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

        <div className="prompt-line">
          <Prompt path="~/questions" />
        </div>
        <br />

      {/* Images show immediately now */}
      {images.length > 0 && (
        <div className="page-images">
          <ImagePreviewGrid images={images} />
        </div>
      )}

        <div className="questions-page">
          <div className="terminal-text">
            {/* Show loading screen while processing */}
            {pageState === PageState.LOADING && (
              <QuestionsLoadingScreen
                isIdentifying={isIdentifying}
                isGeneratingQuestions={isGeneratingQuestions}
                identificationComplete={identificationComplete}
                questionsGenerated={questionsGenerated}
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
                    processStartedRef.current = false;
                    if (abortRef.current) abortRef.current.abort();
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
                <TypingText text={`Error: ${error}`} speed={80} />
                <div className="error-actions">
                  <button
                    onClick={() => {
                      processStartedRef.current = false;
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
                      speed={80}
                      onceKey={`${typingSessionKey}|plant-label`}
                      onComplete={() => {
                        console.log('Plant name typing complete');
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
                    text="Please answer the following questions:"
                    speed={80}
                    onceKey={`${typingSessionKey}|instructions`}
                    onComplete={() => {
                      console.log('Instructions typing complete');
                      setInstructionsTyped(true);
                    }}
                  />
                ) : (
                  <div>Please answer the following questions:</div>
                )}

                  {(instructionsTyped || isNavigatingBack) &&
                    questions.map((question: any, index: number) => {
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
                                  if (!existing || !existing.skipped) {
                                    // Store a skipped marker (excluded downstream)
                                    addAnswer({
                                      questionId: question.id,
                                      answer: false,
                                      skipped: true,
                                    });
                                  } else {
                                    // Toggle off skip clears answer entirely
                                    removeAnswer(question.id);
                                  }
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

            {(instructionsTyped || isNavigatingBack) && !noPlantMessage && (
              <div className="additional-comments-section">
                Any additional observations:
                <div className="comments-container">
                  <textarea
                    value={additionalComments}
                    onChange={(e) => setAdditionalComments(e.target.value)}
                    className="comments-textarea"
                    placeholder="Describe any other symptoms, changes, etc."
                    rows={3}
                  />
                </div>
              </div>
            )}

          {pageState === PageState.SHOWING_CONTENT &&
            !noPlantMessage &&
            questions.length === 0 &&
            (plantNameTyped || isNavigatingBack) && (
              <div className="no-questions">
                <TypingText
                  text="No additional questions needed. Proceeding to diagnosis..."
                  speed={80}
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
  );
}
