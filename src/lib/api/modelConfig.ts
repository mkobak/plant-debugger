export type ModelKey = 'modelHigh' | 'modelMedium' | 'modelLow';
export type ModelBucket = 'flash' | 'flash-lite';

// Map ModelKey to concrete Gemini model names. modelHigh and modelMedium
// currently share gemini-3.8-flash (Google has not shipped a Pro newer than
// 3.1-preview); the separate key is kept so a stronger model can be slotted
// back in without touching call sites.
export const MODEL_BY_KEY: Record<ModelKey, string> = {
  modelHigh: 'gemini-3.8-flash',
  modelMedium: 'gemini-3.8-flash',
  modelLow: 'gemini-3.5-flash-lite',
};

// Map ModelKey to pricing bucket
export const BUCKET_BY_KEY: Record<ModelKey, ModelBucket> = {
  modelHigh: 'flash',
  modelMedium: 'flash',
  modelLow: 'flash-lite',
};

// Pricing per 1M tokens in USD (Paid Tier, ai.google.dev/gemini-api/docs/pricing).
// gemini-3.8-flash is at an introductory rate through Dec 31, 2026; from
// Jan 1, 2027 it becomes input 1.5 / output 7.5. Thinking tokens are billed
// at the output rate.
export const PRICES: Record<ModelBucket, { input: number; output: number }> = {
  flash: { input: 0.75, output: 3.75 },
  'flash-lite': { input: 0.3, output: 2.5 },
};
