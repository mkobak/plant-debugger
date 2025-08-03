import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Different models for different use cases as specified in prompts.txt
export const models = {
  // High-end model for final diagnosis
  modelHigh: genAI.getGenerativeModel({ model: 'gemini-2.5-pro' }),
  // Medium model for questions generation  
  modelMedium: genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }),
  // Low model for plant identification and initial diagnosis
  modelLow: genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' }),
};

export default genAI;
