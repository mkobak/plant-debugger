'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import TerminalLayout from '@/components/layout/TerminalLayout';
import SharedHeader from '@/components/layout/SharedHeader';
import TypingText from '@/components/ui/TypingText';
import ActionButton from '@/components/ui/ActionButton';
import QuestionsLoadingScreen from '@/components/ui/QuestionsLoadingScreen';
import { useDiagnosis } from '@/context/DiagnosisContext';
import { useNavigation } from '@/hooks/useNavigation';
import { identifyPlant, generateQuestions } from '@/lib/api/diagnosis';

// Simplified page states
enum PageState {
  LOADING = 'loading',
  SHOWING_CONTENT = 'showing_content',
  ERROR = 'error'
}

enum LoadingPhase {
  ANALYZING = 'analyzing',
  IDENTIFYING = 'identifying', 
  GENERATING_QUESTIONS = 'generating_questions',
  COMPLETE = 'complete'
}

export default function QuestionsPage() {
  const router = useRouter();
  const processStartedRef = useRef(false);
  const { goHome, goToResults, maxReachedStep } = useNavigation();
  const {
    images,
    setCurrentStep,
    setMaxReachedStep,
    plantIdentification,
    setPlantIdentification,
    updatePlantSpecies,
    questions,
    setQuestions,
    answers,
    addAnswer,
  } = useDiagnosis();

  // Simplified state management
  const [pageState, setPageState] = useState<PageState>(PageState.LOADING);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>(LoadingPhase.ANALYZING);
  const [editablePlantName, setEditablePlantName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isNavigatingBack, setIsNavigatingBack] = useState(false);
  const [plantNameTyped, setPlantNameTyped] = useState(false);
  const [instructionsTyped, setInstructionsTyped] = useState(false);

  // Initialize page
  useEffect(() => {
    console.log('QuestionsPage initializing - images:', images.length, 'questions:', questions.length);
    setCurrentStep(2);

    // Check if we have images, if not redirect after a brief delay
    if (images.length === 0) {
      const timeout = setTimeout(() => {
        console.log('No images found, redirecting to upload');
        router.push('/upload');
      }, 100);
      return () => clearTimeout(timeout);
    }

    // If we already have questions, we're navigating back
    if (questions.length > 0 && plantIdentification) {
      console.log('Already have questions and plant identification, showing content');
      setIsNavigatingBack(true);
      setEditablePlantName(plantIdentification.species || '');
      setPlantNameTyped(true);
      setInstructionsTyped(true);
      setPageState(PageState.SHOWING_CONTENT);
      return;
    }

    // Start the identification and question generation process
    if (!processStartedRef.current) {
      console.log('Starting identification and question generation process');
      processStartedRef.current = true;
      startDiagnosisProcess();
    }
  }, [images.length, questions.length, plantIdentification, setCurrentStep, router]);

  const startDiagnosisProcess = async () => {
    try {
      setPageState(PageState.LOADING);
      setLoadingPhase(LoadingPhase.ANALYZING);
      setError('');

      // Step 1: Identify plant
      console.log('Step 1: Identifying plant...');
      setLoadingPhase(LoadingPhase.IDENTIFYING);
      
      const identification = await identifyPlant(images);
      console.log('Plant identified:', identification);
      
      setPlantIdentification(identification);
      setEditablePlantName(identification.species || 'Unknown species');

      // Step 2: Generate questions
      console.log('Step 2: Generating questions...');
      setLoadingPhase(LoadingPhase.GENERATING_QUESTIONS);
      
      const generatedQuestions = await generateQuestions(images);
      console.log('Questions generated:', generatedQuestions.length);
      
      setQuestions(generatedQuestions);
      setLoadingPhase(LoadingPhase.COMPLETE);

      // Show content after a brief delay
      setTimeout(() => {
        console.log('Process complete, showing content');
        setPageState(PageState.SHOWING_CONTENT);
      }, 500);

    } catch (error) {
      console.error('Diagnosis process failed:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
      setPageState(PageState.ERROR);
      processStartedRef.current = false;
    }
  };

  const handleAnswer = (questionId: string, answer: boolean) => {
    addAnswer({
      questionId,
      answer,
      skipped: false
    });
  };

  const getAnswer = (questionIndex: number) => {
    return answers.find((a: any) => a.questionId === questions[questionIndex]?.id);
  };

  const handleReset = () => {
    goHome();
  };

  const handleNext = () => {
    setMaxReachedStep(Math.max(maxReachedStep, 3));
    goToResults();
  };

  const canProceed = pageState === PageState.SHOWING_CONTENT || pageState === PageState.ERROR;

  // Loading state calculations for the loading screen
  const isIdentifying = loadingPhase === LoadingPhase.IDENTIFYING;
  const isGeneratingQuestions = loadingPhase === LoadingPhase.GENERATING_QUESTIONS;
  const identificationComplete = loadingPhase === LoadingPhase.GENERATING_QUESTIONS || loadingPhase === LoadingPhase.COMPLETE;
  const questionsGenerated = loadingPhase === LoadingPhase.COMPLETE;

  return (
    <TerminalLayout title="plant-debugger:~/questions$">
      <SharedHeader currentStep={2} showNavigation={true} />
      
      <div className="questions-page">
        <div className="terminal-text">
          {/* Show loading screen while processing */}
          {pageState === PageState.LOADING && (
            <QuestionsLoadingScreen 
              isIdentifying={isIdentifying}
              isGeneratingQuestions={isGeneratingQuestions}
              identificationComplete={identificationComplete}
              questionsGenerated={questionsGenerated}
              onComplete={() => {
                if (loadingPhase === LoadingPhase.COMPLETE) {
                  setPageState(PageState.SHOWING_CONTENT);
                }
              }}
            />
          )}

          {/* Show error message */}
          {error && (
            <div className="error-message">
              <TypingText text={`> Error: ${error}`} speed={80} />
              <div className="error-actions">
                <button onClick={() => {
                  processStartedRef.current = false;
                  startDiagnosisProcess();
                }} className="retry-button">
                  [ Retry ]
                </button>
                <button onClick={handleReset} className="reset-button">
                  [ Reset ]
                </button>
              </div>
            </div>
          )}

          {/* Show plant identification and questions when ready */}
          {pageState === PageState.SHOWING_CONTENT && plantIdentification && (
            <div className="plant-identification">
              {!isNavigatingBack ? (
                <TypingText 
                  text={`> Plant identified:`} 
                  speed={80}
                  onComplete={() => setPlantNameTyped(true)}
                />
              ) : (
                <div>&gt; Plant identified:</div>
              )}
              {(plantNameTyped || isNavigatingBack) && (
                <div className="plant-name-container">
                  <span className="plant-name-label"> </span>
                  <input
                    type="text"
                    value={editablePlantName}
                    onChange={(e) => {
                      setEditablePlantName(e.target.value);
                      updatePlantSpecies(e.target.value);
                    }}
                    className="plant-name-input"
                    placeholder="Unknown species"
                  />
                </div>
              )}
            </div>
          )}

          {pageState === PageState.SHOWING_CONTENT && questions.length > 0 && (plantNameTyped || isNavigatingBack) && (
            <div className="questions-section">
              <br />
              {!isNavigatingBack ? (
                <TypingText 
                  text="> Please answer the following questions to improve debugging accuracy:"
                  speed={80}
                  onComplete={() => setInstructionsTyped(true)}
                />
              ) : (
                <div>&gt; Please answer the following questions to improve debugging accuracy:</div>
              )}
              
              {(instructionsTyped || isNavigatingBack) && questions.map((question: any, index: number) => (
                <div key={question.id} className="question-item">
                  {!isNavigatingBack ? (
                    <TypingText 
                      text={`> ${question.question}`}
                      speed={80}
                    />
                  ) : (
                    <div>&gt; {question.question}</div>
                  )}
                  
                  <div className="question-buttons">
                    <button
                      className={`answer-button ${getAnswer(index)?.answer === true ? 'selected' : ''}`}
                      onClick={() => handleAnswer(question.id, true)}
                    >
                      [Y] Yes
                    </button>
                    <button
                      className={`answer-button ${getAnswer(index)?.answer === false && !getAnswer(index)?.skipped ? 'selected' : ''}`}
                      onClick={() => handleAnswer(question.id, false)}
                    >
                      [N] No
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pageState === PageState.SHOWING_CONTENT && questions.length === 0 && (plantNameTyped || isNavigatingBack) && (
            <div className="no-questions">
              <TypingText 
                text="> No additional questions needed. Proceeding to diagnosis..."
                speed={80}
              />
            </div>
          )}
        </div>

        <div className="page-actions">
          <ActionButton 
            variant="reset"
            onClick={handleReset}
          >
            [ Reset ]
          </ActionButton>
          
          <ActionButton 
            variant="primary"
            href="/results"
            disabled={!canProceed}
            className={canProceed ? 'has-images' : ''}
            onClick={handleNext}
          >
            [ Debug ]
          </ActionButton>
        </div>
      </div>
    </TerminalLayout>
  );
}
