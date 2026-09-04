import type { NextRequest } from 'next/server';
import { getClientId } from './shared';
import { BUCKET_BY_KEY, PRICES, type ModelKey } from './modelConfig';

import { logger, isDebugEnabled } from '@/lib/logger';
export interface UsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  /** Thinking tokens: billed at the output rate on Gemini 3 models. */
  thoughtsTokenCount?: number;
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

function rateFor(modelKey: ModelKey, kind: 'input' | 'output'): number {
  return PRICES[BUCKET_BY_KEY[modelKey]][kind];
}

function dollars(tokens: number | undefined, perMillion: number): number {
  if (!tokens || tokens <= 0) return 0;
  return (tokens / 1_000_000) * perMillion;
}

// This store only feeds terminal debug output. The key is the client-supplied
// x-pb-client-id, so it is capped and only populated when debug logging is on
// — otherwise arbitrary ids could grow it without bound on a warm instance.
const MAX_TRACKED_CLIENTS = 200;

// Keep a process-global store so multiple route modules share the same totals
const costStoreKey = '__pb_cost_store__';
const globalStore = globalThis as typeof globalThis & {
  [costStoreKey]?: Map<string, Totals>;
};
if (!globalStore[costStoreKey]) {
  globalStore[costStoreKey] = new Map<string, Totals>();
}
const store: Map<string, Totals> = globalStore[costStoreKey];

function ensure(id: string): Totals {
  const t = store.get(id);
  if (t) return t;
  if (store.size >= MAX_TRACKED_CLIENTS) {
    // Maps iterate in insertion order: evict the oldest entry
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
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
  if (!usage || !isDebugEnabled()) return;
  const id = getClientId(req);
  const totals = ensure(id);
  const pt = usage.promptTokenCount ?? 0;
  const ct =
    (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
  totals.prompt += pt;
  totals.output += ct;
  const incIn = dollars(pt, rateFor(modelKey, 'input'));
  const incOut = dollars(ct, rateFor(modelKey, 'output'));
  totals.inputCost += incIn;
  totals.outputCost += incOut;
  const m = totals.byModel[modelKey];
  m.calls += 1;
  m.input += pt;
  m.output += ct;
  m.cost += incIn + incOut;
  logger.debug(
    `(CostServer) ${modelKey}@${id}: input ${pt}, output ${ct} (incl. ${usage.thoughtsTokenCount ?? 0} thinking), cost ~$${(incIn + incOut).toFixed(4)}`
  );
}

export function printAndResetForRequest(
  req: NextRequest,
  context = 'Diagnosis complete'
) {
  if (!isDebugEnabled()) return;
  const id = getClientId(req);
  const totals = store.get(id);
  const callsLine = `Client: ${id}`;
  if (!totals) {
    logger.debug('====================================');
    logger.debug(`${context}: No usage recorded`);
    logger.debug(callsLine);
    logger.debug('====================================');
    return;
  }
  const total = totals.inputCost + totals.outputCost;
  logger.debug('====================================');
  logger.debug(`${context}: Gemini API cost summary`);
  logger.debug(callsLine);
  (Object.keys(totals.byModel) as ModelKey[]).forEach((k) => {
    logger.debug(
      `- ${k} (${MODEL_LABEL[k]}): ${totals.byModel[k].calls} calls (~$${totals.byModel[k].cost.toFixed(4)})`
    );
  });
  logger.debug(
    `Input tokens: ${totals.prompt.toLocaleString()} (~$${totals.inputCost.toFixed(4)})`
  );
  logger.debug(
    `Output tokens (incl. thinking): ${totals.output.toLocaleString()} (~$${totals.outputCost.toFixed(4)})`
  );
  logger.debug(`Total cost: $${total.toFixed(4)}`);
  logger.debug('====================================');
  store.delete(id);
}

const MODEL_LABEL: Record<ModelKey, string> = {
  modelHigh: 'high',
  modelMedium: 'medium',
  modelLow: 'low',
};

export function resetForRequest(req: NextRequest) {
  const id = getClientId(req);
  store.delete(id);
}

/** Test-only: number of tracked clients. */
export function trackedClientCount(): number {
  return store.size;
}
