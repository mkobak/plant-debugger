import { DiagnosisResult } from '@/types';

/** Flat JSON-mode fields produced by the final-diagnosis schema. */
export interface FinalDiagnosisFields {
  plant?: string;
  primaryDiagnosis?: string;
  primaryConfidence?: string;
  primarySummary?: string;
  primaryReasoning?: string;
  primaryTreatmentPlan?: string;
  primaryPreventionTips?: string;
  secondaryDiagnosis?: string;
  secondaryConfidence?: string;
  secondarySummary?: string;
  secondaryReasoning?: string;
  secondaryTreatmentPlan?: string;
  secondaryPreventionTips?: string;
  careTips?: string;
}

/** Maps the schema's flat fields into the DiagnosisResult shape. */
export function mapFinalDiagnosis(data: FinalDiagnosisFields): DiagnosisResult {
  return {
    primary: {
      condition: data.primaryDiagnosis as string,
      confidence:
        data.primaryConfidence as DiagnosisResult['primary']['confidence'],
      summary: data.primarySummary as string,
      reasoning: data.primaryReasoning as string,
      treatment: data.primaryTreatmentPlan as string,
      prevention: data.primaryPreventionTips as string,
    },
    ...(data.secondaryDiagnosis && {
      secondary: {
        condition: data.secondaryDiagnosis,
        confidence:
          data.secondaryConfidence as DiagnosisResult['primary']['confidence'],
        summary: data.secondarySummary as string,
        reasoning: data.secondaryReasoning as string,
        treatment: data.secondaryTreatmentPlan as string,
        prevention: data.secondaryPreventionTips as string,
      },
    }),
    careTips: data.careTips || 'No care tips provided',
    plant: data.plant,
  };
}
