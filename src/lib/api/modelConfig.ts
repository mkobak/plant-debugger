export type ModelKey = 'modelHigh' | 'modelMedium' | 'modelLow';
export type ModelBucket = 'pro' | 'flash' | 'flash-lite';

// Map ModelKey to concrete Gemini model names
export const MODEL_BY_KEY: Record<ModelKey, string> = {
  modelHigh: 'gemini-2.5-flash',
  modelMedium: 'gemini-2.5-flash',
  modelLow: 'gemini-2.5-flash-lite',
};

// Map ModelKey to pricing bucket
export const BUCKET_BY_KEY: Record<ModelKey, ModelBucket> = {
  modelHigh: 'flash',
  modelMedium: 'flash',
  modelLow: 'flash-lite',
};

// Pricing per 1M tokens in USD (Paid Tier)
export const PRICES = {
  pro: {
    input: { low: 1.25, high: 2.5 },
    output: { low: 10, high: 15 },
    threshold: 200_000,
  },
  flash: { input: 0.3, output: 2.5 },
  'flash-lite': { input: 0.1, output: 0.4 },
} as const;
