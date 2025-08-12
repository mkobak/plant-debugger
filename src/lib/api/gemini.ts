import { GoogleGenerativeAI } from '@google/generative-ai';
import { MODEL_BY_KEY } from './modelConfig';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Different models for different use cases as specified in prompts.txt
export const models = {
  modelHigh: genAI.getGenerativeModel({ model: MODEL_BY_KEY.modelHigh }),
  modelMedium: genAI.getGenerativeModel({ model: MODEL_BY_KEY.modelMedium }),
  modelLow: genAI.getGenerativeModel({ model: MODEL_BY_KEY.modelLow }),
};

export default genAI;
