/**
 * Pure helpers for the combined "rank consensus diagnoses + ask clarifying
 * questions" step, extracted for unit testing.
 */

import type { DiagnosticQuestion } from '@/types';

export interface RankAndQuestions {
  rankedDiagnoses: string;
  questions: DiagnosticQuestion[];
}

const QUESTION_KEYS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'] as const;

/** Parses the JSON-mode output of the rank+questions call. Throws on
 *  malformed JSON or a missing ranking so the caller can fall back. */
export function parseRankAndQuestions(text: string): RankAndQuestions {
  if (!text.trim()) throw new Error('Empty JSON response');
  const data = JSON.parse(text) as Record<string, unknown>;
  const ranked =
    typeof data.rankedDiagnoses === 'string' ? data.rankedDiagnoses.trim() : '';
  if (!ranked) throw new Error('Missing rankedDiagnoses');

  const questions: DiagnosticQuestion[] = [];
  QUESTION_KEYS.forEach((key, i) => {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) {
      questions.push({
        id: `q${i + 1}`,
        question: value.trim(),
        type: 'yes_no',
        required: false,
      });
    }
  });
  return { rankedDiagnoses: ranked, questions };
}

/** Local stand-in for the model ranking when that call fails: unique
 *  diagnoses in first-seen order, capped at 5. */
export function fallbackRanking(rawDiagnoses: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of rawDiagnoses) {
    for (const item of raw.split(',')) {
      const name = item.trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      out.push(name);
      if (out.length === 5) return out.join(', ');
    }
  }
  return out.join(', ');
}
