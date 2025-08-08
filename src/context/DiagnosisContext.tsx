'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { typingSession } from '@/lib/typingSession';
import { 
  PlantImage, 
  PlantIdentification, 
  DiagnosticQuestion, 
  DiagnosticAnswer,
  DiagnosisResult 
} from '@/types';

interface DiagnosisContextType {
  images: PlantImage[];
  setImages: (images: PlantImage[]) => void;
  addImage: (image: PlantImage) => void;
  removeImage: (imageId: string) => void;
  clearImages: () => void;
  
  // Plant identification state
  plantIdentification: PlantIdentification | null;
  setPlantIdentification: (identification: PlantIdentification | null) => void;
  updatePlantSpecies: (species: string) => void;
  
  // Questions state
  questions: DiagnosticQuestion[];
  setQuestions: (questions: DiagnosticQuestion[]) => void;
  answers: DiagnosticAnswer[];
  setAnswers: (answers: DiagnosticAnswer[]) => void;
  addAnswer: (answer: DiagnosticAnswer) => void;
  removeAnswer: (questionId: string) => void;
  additionalComments: string;
  setAdditionalComments: (comments: string) => void;
  // Special case: persisted message when no plant is detected
  noPlantMessage: string;
  setNoPlantMessage: (msg: string) => void;
  
  // Results state
  diagnosisResult: DiagnosisResult | null;
  setDiagnosisResult: (result: DiagnosisResult | null) => void;
  lastDiagnosisSignature: string | null;
  setLastDiagnosisSignature: (sig: string | null) => void;
  lastQAImagesSignature: string | null;
  setLastQAImagesSignature: (sig: string | null) => void;
  // Guard to prevent duplicate runs per images signature (e.g., StrictMode)
  qaProcessingSignature: string | null;
  setQaProcessingSignature: (sig: string | null) => void;
  
  // Loading states
  isIdentifying: boolean;
  setIsIdentifying: (loading: boolean) => void;
  isGeneratingQuestions: boolean;
  setIsGeneratingQuestions: (loading: boolean) => void;
  isDiagnosing: boolean;
  setIsDiagnosing: (loading: boolean) => void;
  
  // Reset function
  resetAll: () => void;
}

const DiagnosisContext = createContext<DiagnosisContextType | undefined>(undefined);

interface DiagnosisProviderProps {
  children: ReactNode;
}

export function DiagnosisProvider({ children }: DiagnosisProviderProps) {
  const [images, setImages] = useState<PlantImage[]>([]);
  // Keep the global state focused on domain data; avoid UI/step flags here
  
  // Plant identification state
  const [plantIdentification, setPlantIdentification] = useState<PlantIdentification | null>(null);
  
  // Questions state
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [answers, setAnswers] = useState<DiagnosticAnswer[]>([]);
  const [additionalComments, setAdditionalComments] = useState<string>('');
  const [noPlantMessage, setNoPlantMessage] = useState<string>('');
  
  // Results state
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null);
  const [lastDiagnosisSignature, setLastDiagnosisSignature] = useState<string | null>(null);
  const [lastQAImagesSignature, setLastQAImagesSignature] = useState<string | null>(null);
  const [qaProcessingSignature, setQaProcessingSignature] = useState<string | null>(null);
  
  // Loading states
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const setImagesWithLogging = (newImages: PlantImage[]) => {
    setImages(prev => {
      const prevSig = prev.map(i => i.id).join('|');
      const newSig = newImages.map(i => i.id).join('|');
      if (prevSig !== newSig) {
        // Images changed: clear dependent state so flows rerun
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
    setImages(prev => [...prev, image]);
  };

  const removeImage = (imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
  };

  const clearImages = () => {
    setImages([]);
  };

  const addAnswer = (answer: DiagnosticAnswer) => {
    setAnswers(prev => {
      const existingIndex = prev.findIndex(a => a.questionId === answer.questionId);
      if (existingIndex >= 0) {
        const newAnswers = [...prev];
        newAnswers[existingIndex] = answer;
        return newAnswers;
      }
      return [...prev, answer];
    });
    // Answers changed: invalidate any existing diagnosis
    if (diagnosisResult) setDiagnosisResult(null);
    if (lastDiagnosisSignature) setLastDiagnosisSignature(null);
  };

  const removeAnswer = (questionId: string) => {
    setAnswers(prev => prev.filter(a => a.questionId !== questionId));
    if (diagnosisResult) setDiagnosisResult(null);
    if (lastDiagnosisSignature) setLastDiagnosisSignature(null);
  };

  const updatePlantSpecies = (species: string) => {
    setPlantIdentification(prev => {
      if (!prev) return null;
      return { ...prev, species };
    });
  };
  
  // When comments change, invalidate diagnosis so it reruns on next Debug
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
  // Reset typing animations memory so they play again
  typingSession.reset();
  };

  const value = {
    images,
    setImages: setImagesWithLogging,
    addImage,
    removeImage,
    clearImages,
    plantIdentification,
    setPlantIdentification,
    updatePlantSpecies,
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
