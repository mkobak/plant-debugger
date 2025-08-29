// JSON Schemas for Gemini structured output (JSON mode)
// These schemas enforce consistent structured responses without relying on function calling.

export const finalDiagnosisSchema = {
  type: 'object',
  properties: {
    plant: {
      type: 'string',
      description:
        "Name of the plant in the pictures. In general, use the format 'common name (scientific name)'. For plants where an average person somewhat familiar with plants would know the scientific name, use just the scientific name. E.g., for Monstera Deliciosa, reply 'Monstera Deliciosa' and not 'Swiss Cheese Plant (Monstera Deliciosa)'. If the user provided the name of the plant, verify it is correct. If it's not, provide the name of the plant that you identify from the pictures. Only provide the name of the plant and nothing else.",
    },
    primaryDiagnosis: {
      type: 'string',
      description:
        'Most likely (primary) diagnosis based on the pictures and context.',
    },
    primaryConfidence: {
      type: 'string',
      enum: ['High', 'Medium', 'Low'],
      description:
        'Confidence level in the primary diagnosis. Rate your confidence realistically given the available information.',
    },
    primaryReasoning: {
      type: 'string',
      description:
        'Brief explanation of how the primary diagnosis was reached, referencing visual evidence and user context, in Markdown. Maximum 2 sentences.',
    },
    primaryTreatmentPlan: {
      type: 'string',
      description:
        "Brief step-by-step guide for the user to resolve the issue in case of the primary diagnosis, in Markdown. STRICT FORMAT: 2-3 bullet points, each on its own line starting with '- '.",
    },
    primaryPreventionTips: {
      type: 'string',
      description:
        "Brief actionable advice to prevent recurrence in case of the primary diagnosis, in Markdown. STRICT FORMAT: 2-3 bullet points, each on its own line starting with '- '.",
    },
    primarySummary: {
      type: 'string',
      description:
        "Summary of the reasoning, treatment plan, and prevention tips for the primary diagnosis, in Markdown. STRICT FORMAT: 3-4 bullet points only, each on a new line starting with '- '. Bold and short leading label (e.g., '- **Cause:** ...'). Include programming humor.",
    },
    secondaryDiagnosis: {
      type: 'string',
      nullable: true,
      description:
        'Secondary diagnosis in case there is another likely possibility of what the issue with the plant could be, other than the primary diagnosis.',
    },
    secondaryConfidence: {
      type: 'string',
      nullable: true,
      enum: ['High', 'Medium', 'Low'],
      description:
        'Confidence level in the secondary diagnosis. Rate your confidence realistically given the available information.',
    },
    secondaryReasoning: {
      type: 'string',
      nullable: true,
      description:
        'Brief explanation of how the secondary diagnosis was reached, referencing visual evidence and user context, in Markdown. Maximum 2 sentences.',
    },
    secondaryTreatmentPlan: {
      type: 'string',
      nullable: true,
      description:
        "Brief step-by-step guide for the user to resolve the issue in case of the secondary diagnosis, in Markdown. STRICT FORMAT: 2-3 bullet points, each on its own line starting with '- '.",
    },
    secondaryPreventionTips: {
      type: 'string',
      nullable: true,
      description:
        "Brief actionable advice to prevent recurrence in case of the secondary diagnosis, in Markdown. STRICT FORMAT: 2-3 bullet points, each on its own line starting with '- '.",
    },
    secondarySummary: {
      type: 'string',
      nullable: true,
      description:
        "Summary of the reasoning, treatment plan, and prevention tips for the secondary diagnosis, in Markdown. STRICT FORMAT: 3-4 bullet points only, each on a new line starting with '- '. Bold and short leading label (e.g., '- **Cause:** ...'). Include programming humor.",
    },
    careTips: {
      type: 'string',
      description:
        "Provide general care tips and best practices specific for the user's plant and the plant's situation as seen on the pictures (light, soil, watering, humidity, fertilizer, temperature, pruning/repotting) in Markdown. STRICT FORMAT: 5-8 bullet points ONLY, each on its own line starting with '- '. Start each bullet with a bolded category label like '- **Light:**'. Include programming humor.",
    },
  },
  required: [
    'plant',
    'primaryDiagnosis',
    'primaryConfidence',
    'primaryReasoning',
    'primaryTreatmentPlan',
    'primaryPreventionTips',
    'primarySummary',
    'careTips',
  ],
} as const;

export const questionsSchema = {
  type: 'object',
  properties: {
    Q1: {
      type: 'string',
      description:
        'Short yes/no question to help narrow down a plant diagnosis.',
    },
    Q2: {
      type: 'string',
      description:
        'Short yes/no question to help narrow down a plant diagnosis.',
    },
    Q3: {
      type: 'string',
      nullable: true,
      description:
        'Short yes/no question to help narrow down a plant diagnosis.',
    },
    Q4: {
      type: 'string',
      nullable: true,
      description:
        'Short yes/no question to help narrow down a plant diagnosis.',
    },
    Q5: {
      type: 'string',
      nullable: true,
      description:
        'Short yes/no question to help narrow down a plant diagnosis.',
    },
  },
  required: ['Q1', 'Q2'],
} as const;

export type FinalDiagnosisSchema = typeof finalDiagnosisSchema;
export type QuestionsSchema = typeof questionsSchema;
