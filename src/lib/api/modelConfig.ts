export type ModelKey = 'modelHigh' | 'modelMedium' | 'modelLow';
export type ModelBucket = 'gemini-4-hydrogen' | 'flash' | 'flash-lite';

// Map ModelKey to concrete Gemini model names.
// - modelHigh: one consensus opinion from a different model generation, so it
//   is more independent of the two modelMedium opinions. Gemini 4 Hydrogen
//   defaults to HIGH thinking: every call site must set a level explicitly.
// - modelMedium: the fast workhorse (consensus x2, rank+questions, final).
// - modelLow: simple short tasks (identification, no-plant message); the only
//   tier that supports MINIMAL thinking.
export const MODEL_BY_KEY: Record<ModelKey, string> = {
  modelHigh: 'gemini-4-hydrogen',
  modelMedium: 'gemini-3.8-flash',
  modelLow: 'gemini-3.5-flash-lite',
};

// Map ModelKey to pricing bucket
export const BUCKET_BY_KEY: Record<ModelKey, ModelBucket> = {
  modelHigh: 'gemini-4-hydrogen',
  modelMedium: 'flash',
  modelLow: 'flash-lite',
};

// Pricing per 1M tokens in USD (Paid Tier, aistudio.google.com/docs/pricing).
// gemini-3.8-flash is at an introductory rate through Dec 31, 2026; from
// Jan 1, 2027 it becomes input 1.5 / output 7.5 — the same as Hydrogen, at
// which point moving modelMedium to Hydrogen is worth re-evaluating.
// Thinking tokens are billed at the output rate.
export const PRICES: Record<ModelBucket, { input: number; output: number }> = {
  'gemini-4-hydrogen': { input: 1.5, output: 7.5 },
  flash: { input: 0.75, output: 3.75 },
  'flash-lite': { input: 0.3, output: 2.5 },
};
