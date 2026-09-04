'use client';
import { BUCKET_BY_KEY, PRICES, type ModelKey } from '@/lib/api/modelConfig';

import { logger } from '@/lib/logger';
const ENABLE_LOGS =
  (process.env.NEXT_PUBLIC_ENABLE_CLIENT_COST_LOGS ?? 'true')
    .toString()
    .toLowerCase() !== 'false';

export interface UsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  /** Thinking tokens: billed at the output rate on Gemini 3 models. */
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}

export interface UsageEntry {
  modelKey: ModelKey;
  usage: UsageMetadata;
  route?: string; // Optional: for debugging
}

function rateFor(modelKey: ModelKey, kind: 'input' | 'output'): number {
  return PRICES[BUCKET_BY_KEY[modelKey]][kind];
}

/** Billable output = answer tokens + thinking tokens. */
function outputTokens(usage: UsageMetadata): number {
  return (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
}

function dollars(tokens: number | undefined, perMillion: number): number {
  if (!tokens || tokens <= 0) return 0;
  return (tokens / 1_000_000) * perMillion;
}

class CostTracker {
  private entries: UsageEntry[] = [];

  record(entry: UsageEntry | null | undefined) {
    if (!entry || !entry.usage) return;
    this.entries.push(entry);
    // Log each call for debugging and cost tracking
    const pt = entry.usage.promptTokenCount ?? 0;
    const ct = outputTokens(entry.usage);
    const inCost = dollars(pt, rateFor(entry.modelKey, 'input'));
    const outCost = dollars(ct, rateFor(entry.modelKey, 'output'));
    const route = entry.route ? ` [${entry.route}]` : '';
    if (ENABLE_LOGS) {
      logger.debug(
        `(CostTracker) ${entry.modelKey}${route}: input ${pt}, output ${ct}, cost ~$${(inCost + outCost).toFixed(4)}`
      );
    }
  }

  recordMany(entries: UsageEntry[] | null | undefined) {
    if (!entries) return;
    entries.forEach((e) => this.record(e));
  }

  reset() {
    this.entries = [];
    // Log reset for debugging
    logger.debug('[CostTracker] reset');
  }

  totals() {
    let inputTokens = 0;
    let outputTokensTotal = 0;
    let inputCost = 0;
    let outputCost = 0;
    const byModel: Record<
      ModelKey,
      { calls: number; input: number; output: number; cost: number }
    > = {
      modelHigh: { calls: 0, input: 0, output: 0, cost: 0 },
      modelMedium: { calls: 0, input: 0, output: 0, cost: 0 },
      modelLow: { calls: 0, input: 0, output: 0, cost: 0 },
    };

    for (const e of this.entries) {
      const pt = e.usage.promptTokenCount ?? 0;
      const ct = outputTokens(e.usage);
      inputTokens += pt;
      outputTokensTotal += ct;
      const incIn = dollars(pt, rateFor(e.modelKey, 'input'));
      const incOut = dollars(ct, rateFor(e.modelKey, 'output'));
      inputCost += incIn;
      outputCost += incOut;
      const b = byModel[e.modelKey];
      b.calls += 1;
      b.input += pt;
      b.output += ct;
      b.cost += incIn + incOut;
    }

    return {
      calls: this.entries.length,
      inputTokens,
      outputTokens: outputTokensTotal,
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      byModel,
    };
  }

  printSummary(context: string = 'Diagnosis complete') {
    const t = this.totals();
    const lines = [
      '====================================',
      `${context}: Gemini API cost summary`,
      `Calls: ${t.calls}`,
      `- modelHigh: ${t.byModel.modelHigh.calls} calls (~$${t.byModel.modelHigh.cost.toFixed(4)})`,
      `- modelMedium: ${t.byModel.modelMedium.calls} calls (~$${t.byModel.modelMedium.cost.toFixed(4)})`,
      `- modelLow: ${t.byModel.modelLow.calls} calls (~$${t.byModel.modelLow.cost.toFixed(4)})`,
      `Input tokens: ${t.inputTokens.toLocaleString()} (~$${t.inputCost.toFixed(4)})`,
      `Output tokens (incl. thinking): ${t.outputTokens.toLocaleString()} (~$${t.outputCost.toFixed(4)})`,
      `Total cost: $${t.totalCost.toFixed(4)}`,
      '====================================',
    ];
    // Log summary as a single message block for readability
    if (ENABLE_LOGS) {
      logger.debug(lines.join('\n'));
    }
  }
}

export const costTracker = new CostTracker();
