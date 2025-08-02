// Common types for the Plant Debugger application

export interface PlantImage {
  id: string;
  file: File;
  url: string;
  compressed?: boolean;
  size: number;
}

export interface DiagnosisStep {
  upload: boolean;
  analysis: boolean;
  questions: boolean;
  results: boolean;
}

export interface PlantIdentification {
  species: string;
  confidence: number;
  commonName?: string;
  scientificName?: string;
}

export interface DiagnosticQuestion {
  id: string;
  question: string;
  type: 'yes_no' | 'multiple_choice';
  options?: string[];
  required: boolean;
}

export interface DiagnosticAnswer {
  questionId: string;
  answer: string | boolean;
  skipped: boolean;
}

export interface DiagnosisResult {
  primary: {
    condition: string;
    confidence: number;
    severity: 'low' | 'medium' | 'high';
  };
  secondary?: {
    condition: string;
    confidence: number;
    severity: 'low' | 'medium' | 'high';
  };
  summary: string;
  treatment: string;
  prevention: string;
  careTips: string;
}

export interface DiagnosisState {
  step: keyof DiagnosisStep;
  images: PlantImage[];
  plantIdentification?: PlantIdentification;
  questions: DiagnosticQuestion[];
  answers: DiagnosticAnswer[];
  results?: DiagnosisResult;
}
