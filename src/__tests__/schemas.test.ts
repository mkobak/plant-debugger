import {
  finalDiagnosisSchema,
  rankAndQuestionsSchema,
} from '@/lib/api/schemas';

// Basic structural tests to ensure schemas don't accidentally lose required fields or descriptions.

describe('Structured Output Schemas', () => {
  test('finalDiagnosisSchema required fields', () => {
    const required = finalDiagnosisSchema.required;
    const expected = [
      'plant',
      'primaryDiagnosis',
      'primaryConfidence',
      'primaryReasoning',
      'primaryTreatmentPlan',
      'primaryPreventionTips',
      'primarySummary',
      'careTips',
    ];
    expect(required).toEqual(expected);
  });

  test('finalDiagnosisSchema descriptions preserved', () => {
    const props: any = finalDiagnosisSchema.properties;
    expect(props.plant.description).toMatch(/Name of the plant/);
    expect(props.primaryReasoning.description).toMatch(/Maximum 2 sentences/);
    expect(props.primaryTreatmentPlan.description).toMatch(/step-by-step/);
    expect(props.careTips.description).toMatch(/care tips/);
  });

  test('rankAndQuestionsSchema required fields and ordering', () => {
    expect(rankAndQuestionsSchema.required).toEqual([
      'rankedDiagnoses',
      'Q1',
      'Q2',
    ]);
    // Ranking must stream before the questions that depend on it
    expect(rankAndQuestionsSchema.propertyOrdering[0]).toBe('rankedDiagnoses');
  });

  test('rankAndQuestionsSchema descriptions preserved', () => {
    const props: any = rankAndQuestionsSchema.properties;
    expect(props.Q1.description).toMatch(/yes\/no question/);
    expect(props.rankedDiagnoses.description).toMatch(/most likely first/);
  });
});
