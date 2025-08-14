import { GoogleGenerativeAI } from '@google/generative-ai';
import { MODEL_BY_KEY } from './modelConfig';

let _genAI: GoogleGenerativeAI | null = null;
let _models: {
  modelHigh: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;
  modelMedium: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;
  modelLow: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;
} | null = null;

export function getGenAI(): GoogleGenerativeAI {
  if (_genAI) return _genAI;
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
  _genAI = new GoogleGenerativeAI(key);
  return _genAI;
}

export function getModels() {
  if (_models) return _models;
  const genAI = getGenAI();
  _models = {
    modelHigh: genAI.getGenerativeModel({ model: MODEL_BY_KEY.modelHigh }),
    modelMedium: genAI.getGenerativeModel({ model: MODEL_BY_KEY.modelMedium }),
    modelLow: genAI.getGenerativeModel({ model: MODEL_BY_KEY.modelLow }),
  } as const;
  return _models;
}

export const models = new Proxy(
  {},
  {
    get(_, prop: keyof ReturnType<typeof getModels>) {
      const m = getModels();
      return (m as any)[prop];
    },
    ownKeys() {
      return Object.keys(getModels());
    },
    getOwnPropertyDescriptor() {
      return { enumerable: true, configurable: true } as PropertyDescriptor;
    },
  }
) as unknown as ReturnType<typeof getModels>;

const geminiApi = { getGenAI, getModels, models };
export default geminiApi;
