'use client';

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from 'react';
import { typingSession } from '@/lib/typingSession';
import {
  PlantImage,
  PlantIdentification,
  DiagnosticQuestion,
  DiagnosticAnswer,
  DiagnosisResult,
} from '@/types';
import { costTracker } from '@/lib/costTracker';

interface DiagnosisContextType {
  images: PlantImage[];
  setImages: (images: PlantImage[]) => void;
  addImage: (image: PlantImage) => void;
  removeImage: (imageId: string) => void;
  clearImages: () => void;

  // Plant identification state
  plantIdentification: PlantIdentification | null;
  setPlantIdentification: (identification: PlantIdentification | null) => void;
  updatePlantName: (name: string) => void;

  // Diagnostic questions and answers
  questions: DiagnosticQuestion[];
  setQuestions: (questions: DiagnosticQuestion[]) => void;
  answers: DiagnosticAnswer[];
  setAnswers: (answers: DiagnosticAnswer[]) => void;
  addAnswer: (answer: DiagnosticAnswer) => void;
  removeAnswer: (questionId: string) => void;
  additionalComments: string;
  setAdditionalComments: (comments: string) => void;
  // Persisted message for 'no plant detected' case
  noPlantMessage: string;
  setNoPlantMessage: (msg: string) => void;

  // Diagnosis result and related state
  diagnosisResult: DiagnosisResult | null;
  setDiagnosisResult: (result: DiagnosisResult | null) => void;
  lastDiagnosisSignature: string | null;
  setLastDiagnosisSignature: (sig: string | null) => void;
  lastQAImagesSignature: string | null;
  setLastQAImagesSignature: (sig: string | null) => void;
  // Guard to prevent duplicate runs per images signature (e.g., React StrictMode)
  qaProcessingSignature: string | null;
  setQaProcessingSignature: (sig: string | null) => void;

  // Loading flags for async operations
  isIdentifying: boolean;
  setIsIdentifying: (loading: boolean) => void;
  isGeneratingQuestions: boolean;
  setIsGeneratingQuestions: (loading: boolean) => void;
  isDiagnosing: boolean;
  setIsDiagnosing: (loading: boolean) => void;

  // Reset all diagnosis state
  resetAll: () => void;
}

const DiagnosisContext = createContext<DiagnosisContextType | undefined>(
  undefined
);

interface DiagnosisProviderProps {
  children: ReactNode;
}

export function DiagnosisProvider({ children }: DiagnosisProviderProps) {
  const [images, setImages] = useState<PlantImage[]>([]);
  // Only domain data is stored here; UI/step flags are local to components

  // Plant identification state
  const [plantIdentification, setPlantIdentification] =
    useState<PlantIdentification | null>(null);

  // Diagnostic questions and answers
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [answers, setAnswers] = useState<DiagnosticAnswer[]>([]);
  const [additionalComments, setAdditionalComments] = useState<string>('');
  const [noPlantMessage, setNoPlantMessage] = useState<string>('');

  // Diagnosis result and related state
  const [diagnosisResult, setDiagnosisResult] =
    useState<DiagnosisResult | null>(null);
  const [lastDiagnosisSignature, setLastDiagnosisSignature] = useState<
    string | null
  >(null);
  const [lastQAImagesSignature, setLastQAImagesSignature] = useState<
    string | null
  >(null);
  const [qaProcessingSignature, setQaProcessingSignature] = useState<
    string | null
  >(null);

  // Loading flags for async operations
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const setImagesWithLogging = (newImages: PlantImage[]) => {
    setImages((prev) => {
      const prevSig = prev.map((i) => i.id).join('|');
      const newSig = newImages.map((i) => i.id).join('|');
      if (prevSig !== newSig) {
        // If images change, clear dependent state so flows rerun
        setPlantIdentification(null);
        setQuestions([]);
        setAnswers([]);
        setAdditionalComments('');
        setNoPlantMessage('');
        setDiagnosisResult(null);
        setLastDiagnosisSignature(null);
        setLastQAImagesSignature(null);
        setQaProcessingSignature(null);
      }
      return newImages;
    });
  };

  const addImage = (image: PlantImage) => {
    setImages((prev) => [...prev, image]);
  };

  const removeImage = (imageId: string) => {
    setImages((prev) => prev.filter((img) => img.id !== imageId));
  };

  const clearImages = () => {
    setImages([]);
  };

  const addAnswer = (answer: DiagnosticAnswer) => {
    setAnswers((prev) => {
      const existingIndex = prev.findIndex(
        (a) => a.questionId === answer.questionId
      );
      if (existingIndex >= 0) {
        const newAnswers = [...prev];
        newAnswers[existingIndex] = answer;
        return newAnswers;
      }
      return [...prev, answer];
    });
    // Invalidate diagnosis if answers change
    if (diagnosisResult) setDiagnosisResult(null);
    if (lastDiagnosisSignature) setLastDiagnosisSignature(null);
  };

  const removeAnswer = (questionId: string) => {
    setAnswers((prev) => prev.filter((a) => a.questionId !== questionId));
    if (diagnosisResult) setDiagnosisResult(null);
    if (lastDiagnosisSignature) setLastDiagnosisSignature(null);
  };

  const updatePlantName = (name: string) => {
    setPlantIdentification((prev) => {
      if (!prev) return null;
      return { ...prev, name };
    });
  };

  // Invalidate diagnosis if comments change
  useEffect(() => {
    if (diagnosisResult || lastDiagnosisSignature) {
      setDiagnosisResult(null);
      setLastDiagnosisSignature(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [additionalComments]);

  const resetAll = () => {
    setImages([]);
    setPlantIdentification(null);
    setQuestions([]);
    setAnswers([]);
    setAdditionalComments('');
    setNoPlantMessage('');
    setDiagnosisResult(null);
    setLastDiagnosisSignature(null);
    setLastQAImagesSignature(null);
    setQaProcessingSignature(null);
    setIsIdentifying(false);
    setIsGeneratingQuestions(false);
    setIsDiagnosing(false);
    // Reset typing animation memory
    typingSession.reset();
    // Reset the cost tracker for a fresh run
    costTracker.reset();
    // Inform server to reset server-side cost totals (best-effort)
    try {
      fetch('/api/reset-costs', { method: 'POST' });
    } catch { }
  };

  const value = {
    images,
    setImages: setImagesWithLogging,
    addImage,
    removeImage,
    clearImages,
    plantIdentification,
    setPlantIdentification,
    updatePlantName,
    questions,
    setQuestions,
    answers,
    setAnswers,
    addAnswer,
    removeAnswer,
    additionalComments,
    setAdditionalComments,
    noPlantMessage,
    setNoPlantMessage,
    diagnosisResult,
    setDiagnosisResult,
    lastDiagnosisSignature,
    setLastDiagnosisSignature,
    lastQAImagesSignature,
    setLastQAImagesSignature,
    qaProcessingSignature,
    setQaProcessingSignature,
    isIdentifying,
    setIsIdentifying,
    isGeneratingQuestions,
    setIsGeneratingQuestions,
    isDiagnosing,
    setIsDiagnosing,
    resetAll,
  };

  return (
    <DiagnosisContext.Provider value={value}>
      {children}
    </DiagnosisContext.Provider>
  );
}

export function useDiagnosis() {
  const context = useContext(DiagnosisContext);
  if (context === undefined) {
    throw new Error('useDiagnosis must be used within a DiagnosisProvider');
  }
  return context;
}
