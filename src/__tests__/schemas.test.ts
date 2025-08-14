import { finalDiagnosisSchema, questionsSchema } from '@/lib/api/schemas';

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

    test('questionsSchema required fields', () => {
        expect(questionsSchema.required).toEqual(['Q1', 'Q2']);
    });

    test('questionsSchema descriptions preserved', () => {
        const props: any = questionsSchema.properties;
        expect(props.Q1.description).toMatch(/yes\/no question/);
    });
});
