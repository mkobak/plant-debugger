'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import TerminalLayout from '@/components/layout/TerminalLayout';
import SharedHeader from '@/components/layout/SharedHeader';
import TypingText from '@/components/ui/TypingText';
import ActionButton from '@/components/ui/ActionButton';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useDiagnosis } from '@/context/DiagnosisContext';
import { identifyPlant, generateQuestions } from '@/lib/api/diagnosis';

export default function QuestionsPage() {
  const router = useRouter();
  const identificationStartedRef = useRef(false);
  const {
    images,
    setCurrentStep,
    plantIdentification,
    setPlantIdentification,
    questions,
    setQuestions,
    answers,
    addAnswer,
    isIdentifying,
    setIsIdentifying,
    isGeneratingQuestions,
    setIsGeneratingQuestions
  } = useDiagnosis();

  const [line1Complete, setLine1Complete] = useState(false);
  const [line2Complete, setLine2Complete] = useState(false);
  const [line3Complete, setLine3Complete] = useState(false);
  const [identificationComplete, setIdentificationComplete] = useState(false);
  const [questionsGenerated, setQuestionsGenerated] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    setCurrentStep(2);
    
    console.log('QuestionsPage useEffect - images count:', images.length);
    console.log('QuestionsPage useEffect - plantIdentification:', !!plantIdentification);
    console.log('QuestionsPage useEffect - isIdentifying:', isIdentifying);
    console.log('QuestionsPage useEffect - identificationStarted:', identificationStartedRef.current);
    
    // Redirect if no images immediately
    if (images.length === 0) {
      console.log('No images found, redirecting to upload');
      router.push('/upload');
      return;
    }

    // Start plant identification if not already done
    if (!plantIdentification && !isIdentifying && images.length > 0 && !identificationStartedRef.current) {
      console.log('Starting plant identification...');
      identificationStartedRef.current = true;
      startPlantIdentification();
    }
  }, [setCurrentStep, images, plantIdentification, isIdentifying, router]);

  const startPlantIdentification = async () => {
    console.log('startPlantIdentification called, images:', images.length);
    console.log('Images details:', images.map(img => ({ id: img.id, hasFile: !!img.file, fileName: img.file?.name })));
    
    if (!images || images.length === 0) {
      console.log('No images available for identification');
      setError('No images available for identification');
      identificationStartedRef.current = false;
      return;
    }
    
    setIsIdentifying(true);
    setError('');
    
    try {
      const identification = await identifyPlant(images);
      setPlantIdentification(identification);
      setIdentificationComplete(true);
      
      // Start question generation after a brief delay
      setTimeout(() => {
        startQuestionGeneration();
      }, 1000);
    } catch (error) {
      console.error('Plant identification failed:', error);
      setError('Failed to identify plant. Please try again.');
      identificationStartedRef.current = false;
    } finally {
      setIsIdentifying(false);
    }
  };

  const startQuestionGeneration = async () => {
    setIsGeneratingQuestions(true);
    
    try {
      const generatedQuestions = await generateQuestions(images);
      setQuestions(generatedQuestions);
      setQuestionsGenerated(true);
    } catch (error) {
      console.error('Question generation failed:', error);
      setError('Failed to generate questions. You can proceed to diagnosis anyway.');
      setQuestionsGenerated(true); // Allow user to continue
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const handleAnswer = (answer: boolean) => {
    const question = questions[currentQuestionIndex];
    addAnswer({
      questionId: question.id,
      answer,
      skipped: false
    });
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handleSkip = () => {
    const question = questions[currentQuestionIndex];
    addAnswer({
      questionId: question.id,
      answer: false,
      skipped: true
    });
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const isAnswered = (questionIndex: number) => {
    return answers.some(a => a.questionId === questions[questionIndex]?.id);
  };

  const getAnswer = (questionIndex: number) => {
    return answers.find(a => a.questionId === questions[questionIndex]?.id);
  };

  const canProceed = questionsGenerated && (questions.length === 0 || answers.length > 0);

  return (
    <TerminalLayout title="plant-debugger:~/questions$">
      <SharedHeader currentStep={2} showNavigation={true} />
      
      <div className="questions-page">
        <div className="terminal-text">
          <TypingText
            text="> Analyzing uploaded images..."
            speed={80}
            onComplete={() => setLine1Complete(true)}
          />
          
          {line1Complete && (
            <div className="terminal-line">
              <TypingText
                text="> Plant species identification in progress"
                speed={80}
                onComplete={() => setLine2Complete(true)}
              />
              {isIdentifying && <LoadingSpinner />}
            </div>
          )}
          
          {line2Complete && identificationComplete && (
            <div className="terminal-line">
              <TypingText
                text="> Generating diagnostic questions"
                speed={80}
                onComplete={() => setLine3Complete(true)}
              />
              {isGeneratingQuestions && <LoadingSpinner />}
            </div>
          )}

          {error && (
            <div className="error-message">
              <TypingText text={`> Error: ${error}`} speed={80} />
            </div>
          )}

          {plantIdentification && (
            <div className="plant-identification">
              <TypingText 
                text={`> Plant identified: ${plantIdentification.species || 'Unknown species'}`} 
                speed={80} 
              />
            </div>
          )}

          {questionsGenerated && questions.length > 0 && (
            <div className="questions-section">
              <br />
              <TypingText 
                text="> Please answer the following questions to improve diagnosis accuracy:"
                speed={80}
              />
              <br />
              
              {questions.map((question, index) => (
                <div key={question.id} className="question-item">
                  <TypingText 
                    text={`> ${question.question}`}
                    speed={80}
                  />
                  
                  {index <= currentQuestionIndex && (
                    <div className="question-buttons">
                      <button
                        className={`answer-button ${getAnswer(index)?.answer === true ? 'selected' : ''}`}
                        onClick={() => handleAnswer(true)}
                        disabled={isAnswered(index)}
                      >
                        [Y] Yes
                      </button>
                      <button
                        className={`answer-button ${getAnswer(index)?.answer === false && !getAnswer(index)?.skipped ? 'selected' : ''}`}
                        onClick={() => handleAnswer(false)}
                        disabled={isAnswered(index)}
                      >
                        [N] No
                      </button>
                      <button
                        className={`skip-button ${getAnswer(index)?.skipped ? 'selected' : ''}`}
                        onClick={handleSkip}
                        disabled={isAnswered(index)}
                      >
                        [Skip]
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {questionsGenerated && questions.length === 0 && (
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
            href="/"
          >
            [ Reset ]
          </ActionButton>
          
          <ActionButton 
            variant="primary"
            href="/results"
            disabled={!canProceed}
          >
            [ Proceed to Diagnosis ]
          </ActionButton>
        </div>
      </div>
    </TerminalLayout>
  );
}
