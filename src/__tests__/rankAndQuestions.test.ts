/// <reference types="jest" />
import { describe, it, expect } from '@jest/globals';
import {
  parseRankAndQuestions,
  fallbackRanking,
} from '@/lib/api/rankAndQuestions';

describe('parseRankAndQuestions', () => {
  it('extracts the ranking and only the non-empty questions, in order', () => {
    const out = parseRankAndQuestions(
      JSON.stringify({
        rankedDiagnoses: 'Root rot, Spider mites',
        Q1: 'Has the soil stayed wet for days? ',
        Q2: 'Do you see webbing?',
        Q3: null,
        Q4: '',
        Q5: 'Was it repotted recently?',
      })
    );
    expect(out.rankedDiagnoses).toBe('Root rot, Spider mites');
    expect(out.questions.map((q) => q.id)).toEqual(['q1', 'q2', 'q5']);
    expect(out.questions[0]).toEqual({
      id: 'q1',
      question: 'Has the soil stayed wet for days?',
      type: 'yes_no',
      required: false,
    });
  });

  it('throws on empty, malformed, or ranking-less output so callers can fall back', () => {
    expect(() => parseRankAndQuestions('')).toThrow();
    expect(() => parseRankAndQuestions('{not json')).toThrow();
    expect(() => parseRankAndQuestions('{"Q1":"x","Q2":"y"}')).toThrow(
      /rankedDiagnoses/
    );
  });
});

describe('fallbackRanking', () => {
  it('dedupes case-insensitively in first-seen order and caps at 5', () => {
    expect(
      fallbackRanking([
        'Root rot, Spider mites',
        'spider mites, Overwatering',
        'Sun scorch, Aphids, Thrips, Mealybugs',
      ])
    ).toBe('Root rot, Spider mites, Overwatering, Sun scorch, Aphids');
  });

  it('handles empty input', () => {
    expect(fallbackRanking([])).toBe('');
    expect(fallbackRanking(['', ' , '])).toBe('');
  });
});
