// Shared types for the Plant Debugger application

export interface PlantImage {
  id: string;
  file: File;
  url: string;
  compressed?: boolean;
  size: number;
}

export interface PlantIdentification {
  name: string; // empty string means not identified / no plant
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
    confidence: 'High' | 'Medium' | 'Low';
    summary: string;
    reasoning: string;
    treatment: string;
    prevention: string;
  };
  secondary?: {
    condition: string;
    confidence: 'High' | 'Medium' | 'Low';
    summary: string;
    reasoning: string;
    treatment: string;
    prevention: string;
  };
  careTips: string;
  plant?: string;
}
