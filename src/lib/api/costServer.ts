import type { NextRequest } from 'next/server';
import { getClientId } from './shared';
import { BUCKET_BY_KEY, PRICES, type ModelKey } from './modelConfig';

export interface UsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

interface Totals {
  prompt: number;
  output: number;
  inputCost: number;
  outputCost: number;
  byModel: Record<
    ModelKey,
    { calls: number; input: number; output: number; cost: number }
  >;
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

// Keep a process-global store so multiple route modules share the same totals
const globalAny = globalThis as any;
const costStoreKey = '__pb_cost_store__';
if (!globalAny[costStoreKey]) {
  globalAny[costStoreKey] = new Map<string, Totals>();
}
const store: Map<string, Totals> = globalAny[costStoreKey];

function ensure(id: string): Totals {
  const t = store.get(id);
  if (t) return t;
  const v: Totals = {
    prompt: 0,
    output: 0,
    inputCost: 0,
    outputCost: 0,
    byModel: {
      modelHigh: { calls: 0, input: 0, output: 0, cost: 0 },
      modelMedium: { calls: 0, input: 0, output: 0, cost: 0 },
      modelLow: { calls: 0, input: 0, output: 0, cost: 0 },
    },
  };
  store.set(id, v);
  return v;
}

export function recordUsageForRequest(
  req: NextRequest,
  modelKey: ModelKey,
  usage: UsageMetadata | undefined
) {
  const id = getClientId(req);
  if (!usage) return;
  const totals = ensure(id);
  const pt = usage.promptTokenCount ?? 0;
  const ct = usage.candidatesTokenCount ?? 0;
  totals.prompt += pt;
  totals.output += ct;
  const incIn = dollars(pt, rateFor(modelKey, 'input', pt));
  const incOut = dollars(ct, rateFor(modelKey, 'output', pt));
  totals.inputCost += incIn;
  totals.outputCost += incOut;
  const m = totals.byModel[modelKey];
  m.calls += 1;
  m.input += pt;
  m.output += ct;
  m.cost += incIn + incOut;
  console.log(
    `(CostServer) ${modelKey}@${id}: input ${pt}, output ${ct}, cost ~$${(incIn + incOut).toFixed(4)}`
  );
}

export function printAndResetForRequest(
  req: NextRequest,
  context = 'Diagnosis complete'
) {
  const id = getClientId(req);
  // Merge any stray 'unknown' bucket into this id to preserve totals across retries
  const unknown = store.get('unknown');
  if (unknown) {
    const target = ensure(id);
    target.prompt += unknown.prompt;
    target.output += unknown.output;
    target.inputCost += unknown.inputCost;
    target.outputCost += unknown.outputCost;
    (
      Object.keys(unknown.byModel) as Array<keyof typeof unknown.byModel>
    ).forEach((k) => {
      target.byModel[k].calls += unknown.byModel[k].calls;
      target.byModel[k].input += unknown.byModel[k].input;
      target.byModel[k].output += unknown.byModel[k].output;
      target.byModel[k].cost += unknown.byModel[k].cost;
    });
    store.delete('unknown');
  }
  const totals = store.get(id);
  const callsLine = `Client: ${id} (localhost)`;
  if (!totals) {
    console.log('====================================');
    console.log(`${context}: No usage recorded`);
    console.log(callsLine);
    console.log('====================================');
    return;
  }
  const total = totals.inputCost + totals.outputCost;
  console.log('====================================');
  console.log(`${context}: Gemini API cost summary`);
  console.log(callsLine);
  console.log(
    `- modelHigh: ${totals.byModel.modelHigh.calls} calls (~$${totals.byModel.modelHigh.cost.toFixed(4)})`
  );
  console.log(
    `- modelMedium: ${totals.byModel.modelMedium.calls} calls (~$${totals.byModel.modelMedium.cost.toFixed(4)})`
  );
  console.log(
    `- modelLow: ${totals.byModel.modelLow.calls} calls (~$${totals.byModel.modelLow.cost.toFixed(4)})`
  );
  console.log(
    `Input tokens: ${totals.prompt.toLocaleString()} (~$${totals.inputCost.toFixed(4)})`
  );
  console.log(
    `Output tokens: ${totals.output.toLocaleString()} (~$${totals.outputCost.toFixed(4)})`
  );
  console.log(`Total cost: $${total.toFixed(4)}`);
  console.log('====================================');
  store.delete(id);
}

export function resetForRequest(req: NextRequest) {
  const id = getClientId(req);
  store.delete(id);
}
