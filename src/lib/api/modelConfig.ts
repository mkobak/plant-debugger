export type ModelKey = 'modelHigh' | 'modelMedium' | 'modelLow';
export type ModelBucket = 'pro' | 'flash' | 'flash-lite';

// Map ModelKey to concrete Gemini model names
export const MODEL_BY_KEY: Record<ModelKey, string> = {
  modelHigh: 'gemini-3.1-pro-preview',
  modelMedium: 'gemini-3.5-flash',
  modelLow: 'gemini-3.1-flash-lite',
};

// Map ModelKey to pricing bucket
export const BUCKET_BY_KEY: Record<ModelKey, ModelBucket> = {
  modelHigh: 'pro',
  modelMedium: 'flash',
  modelLow: 'flash-lite',
};

// Pricing per 1M tokens in USD (Paid Tier, ai.google.dev/gemini-api/docs/pricing)
export const PRICES = {
  pro: {
    input: { low: 2, high: 4 },
    output: { low: 12, high: 18 },
    threshold: 200_000,
  },
  flash: { input: 1.5, output: 9 },
  'flash-lite': { input: 0.25, output: 1.5 },
} as const;
