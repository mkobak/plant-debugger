export type ModelKey = 'modelHigh' | 'modelMedium' | 'modelLow';
export type ModelBucket = 'pro' | 'flash' | 'flash-lite';

// Map ModelKey to concrete Gemini model names
export const MODEL_BY_KEY: Record<ModelKey, string> = {
  modelHigh: 'gemini-3-pro-preview',
  modelMedium: 'gemini-3-flash-preview',
  modelLow: 'gemini-2.5-flash-lite',
};

// Map ModelKey to pricing bucket
export const BUCKET_BY_KEY: Record<ModelKey, ModelBucket> = {
  modelHigh: 'pro',
  modelMedium: 'flash',
  modelLow: 'flash-lite',
};

// Pricing per 1M tokens in USD (Paid Tier)
export const PRICES = {
  pro: {
    input: { low: 2, high: 4 },
    output: { low: 12, high: 18 },
    threshold: 200_000,
  },
  flash: { input: 0.5, output: 3 },
  'flash-lite': { input: 0.1, output: 0.4 },
} as const;
