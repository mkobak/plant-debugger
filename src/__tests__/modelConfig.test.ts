/// <reference types="jest" />
import { describe, it, expect } from '@jest/globals';
import { MODEL_BY_KEY, BUCKET_BY_KEY, PRICES } from '@/lib/api/modelConfig';
import { costTracker } from '@/lib/costTracker';

describe('model configuration', () => {
  it('points every tier at a current Gemini 3.x model', () => {
    expect(MODEL_BY_KEY.modelHigh).toBe('gemini-3.8-flash');
    expect(MODEL_BY_KEY.modelMedium).toBe('gemini-3.8-flash');
    expect(MODEL_BY_KEY.modelLow).toBe('gemini-3.5-flash-lite');
  });

  it('has a price entry for every bucket in use', () => {
    for (const bucket of Object.values(BUCKET_BY_KEY)) {
      expect(PRICES[bucket].input).toBeGreaterThan(0);
      expect(PRICES[bucket].output).toBeGreaterThan(0);
    }
  });
});

describe('costTracker', () => {
  it('bills thinking tokens at the output rate', () => {
    costTracker.reset();
    costTracker.record({
      modelKey: 'modelMedium',
      usage: {
        promptTokenCount: 1_000_000,
        candidatesTokenCount: 500_000,
        thoughtsTokenCount: 500_000,
      },
    });
    const t = costTracker.totals();
    expect(t.inputTokens).toBe(1_000_000);
    expect(t.outputTokens).toBe(1_000_000);
    expect(t.inputCost).toBeCloseTo(PRICES.flash.input);
    expect(t.outputCost).toBeCloseTo(PRICES.flash.output);
    costTracker.reset();
  });
});
