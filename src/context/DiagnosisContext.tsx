'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { PlantImage } from '@/types';

interface DiagnosisContextType {
  images: PlantImage[];
  setImages: (images: PlantImage[]) => void;
  addImage: (image: PlantImage) => void;
  removeImage: (imageId: string) => void;
  clearImages: () => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
}

const DiagnosisContext = createContext<DiagnosisContextType | undefined>(undefined);

interface DiagnosisProviderProps {
  children: ReactNode;
}

export function DiagnosisProvider({ children }: DiagnosisProviderProps) {
  const [images, setImages] = useState<PlantImage[]>([]);
  const [currentStep, setCurrentStep] = useState(1);

  const addImage = (image: PlantImage) => {
    setImages(prev => [...prev, image]);
  };

  const removeImage = (imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
  };

  const clearImages = () => {
    setImages([]);
    setCurrentStep(1);
  };

  const value = {
    images,
    setImages,
    addImage,
    removeImage,
    clearImages,
    currentStep,
    setCurrentStep,
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
