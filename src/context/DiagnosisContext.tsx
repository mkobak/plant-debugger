'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
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
  currentStep: number;
  setCurrentStep: (step: number) => void;
  maxReachedStep: number;
  setMaxReachedStep: (step: number) => void;
  
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
  
  // Results state
  diagnosisResult: DiagnosisResult | null;
  setDiagnosisResult: (result: DiagnosisResult | null) => void;
  
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
  const [currentStep, setCurrentStep] = useState(0);
  const [maxReachedStep, setMaxReachedStep] = useState(1); // Start with step 1 (upload) reachable
  
  console.log('DiagnosisProvider render - images count:', images.length);
  
  // Plant identification state
  const [plantIdentification, setPlantIdentification] = useState<PlantIdentification | null>(null);
  
  // Questions state
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [answers, setAnswers] = useState<DiagnosticAnswer[]>([]);
  
  // Results state
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null);
  
  // Loading states
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const setImagesWithLogging = (images: PlantImage[]) => {
    console.log('setImages called with:', images.length, 'images');
    setImages(images);
  };

  const addImage = (image: PlantImage) => {
    console.log('addImage called with:', image.id);
    setImages(prev => [...prev, image]);
  };

  const removeImage = (imageId: string) => {
    console.log('removeImage called with:', imageId);
    setImages(prev => prev.filter(img => img.id !== imageId));
  };

  const clearImages = () => {
    console.log('clearImages called');
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
  };

  const updatePlantSpecies = (species: string) => {
    setPlantIdentification(prev => {
      if (!prev) return null;
      return { ...prev, species };
    });
  };

  const resetAll = () => {
    console.log('resetAll called - clearing all state');
    setImages([]);
    setCurrentStep(0);
    setMaxReachedStep(1); // Reset to only step 1 being reachable
    setPlantIdentification(null);
    setQuestions([]);
    setAnswers([]);
    setDiagnosisResult(null);
    setIsIdentifying(false);
    setIsGeneratingQuestions(false);
    setIsDiagnosing(false);
  };

  const value = {
    images,
    setImages: setImagesWithLogging,
    addImage,
    removeImage,
    clearImages,
    currentStep,
    setCurrentStep,
    maxReachedStep,
    setMaxReachedStep,
    plantIdentification,
    setPlantIdentification,
    updatePlantSpecies,
    questions,
    setQuestions,
    answers,
    setAnswers,
    addAnswer,
    diagnosisResult,
    setDiagnosisResult,
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
