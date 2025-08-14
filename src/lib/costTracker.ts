'use client';
import { BUCKET_BY_KEY, PRICES, type ModelKey } from '@/lib/api/modelConfig';

const ENABLE_LOGS =
  (process.env.NEXT_PUBLIC_ENABLE_CLIENT_COST_LOGS ?? 'true')
    .toString()
    .toLowerCase() !== 'false';

export interface UsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

export interface UsageEntry {
  modelKey: ModelKey;
  usage: UsageMetadata;
  route?: string; // Optional: for debugging
}

function rateFor(
  modelKey: ModelKey,
  kind: 'input' | 'output',
  promptTokens: number | undefined
): number {
  const bucket = BUCKET_BY_KEY[modelKey];
  if (bucket === 'pro') {
    const above = (promptTokens ?? 0) > PRICES.pro.threshold;
    return kind === 'input'
      ? above
        ? PRICES.pro.input.high
        : PRICES.pro.input.low
      : above
        ? PRICES.pro.output.high
        : PRICES.pro.output.low;
  }
  if (bucket === 'flash')
    return kind === 'input' ? PRICES.flash.input : PRICES.flash.output;
  return kind === 'input'
    ? PRICES['flash-lite'].input
    : PRICES['flash-lite'].output;
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
    const ct = entry.usage.candidatesTokenCount ?? 0;
    const inCost = dollars(pt, rateFor(entry.modelKey, 'input', pt));
    const outCost = dollars(ct, rateFor(entry.modelKey, 'output', pt));
    const route = entry.route ? ` [${entry.route}]` : '';
    if (ENABLE_LOGS) {
      console.log(
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
    console.log('[CostTracker] reset');
  }

  totals() {
    let inputTokens = 0;
    let outputTokens = 0;
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
      const ct = e.usage.candidatesTokenCount ?? 0;
      inputTokens += pt;
      outputTokens += ct;
      const incIn = dollars(pt, rateFor(e.modelKey, 'input', pt));
      const incOut = dollars(ct, rateFor(e.modelKey, 'output', pt));
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
      outputTokens,
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
      `Output tokens: ${t.outputTokens.toLocaleString()} (~$${t.outputCost.toFixed(4)})`,
      `Total cost: $${t.totalCost.toFixed(4)}`,
      '====================================',
    ];
    // Log summary as a single message block for readability
    if (ENABLE_LOGS) {
      console.log(lines.join('\n'));
    }
  }
}

export const costTracker = new CostTracker();
