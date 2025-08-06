/**
 * API utility functions for Plant Debugger
 */

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(endpoint, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`API request failed: ${response.status} ${errorData}`);
  }

  return response.json();
}

export function createFormData(data: Record<string, any>): FormData {
  const formData = new FormData();
  
  Object.entries(data).forEach(([key, value]) => {
    if (value instanceof File) {
      formData.append(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item instanceof File) {
          formData.append(`${key}[${index}]`, item);
        } else {
          formData.append(`${key}[${index}]`, JSON.stringify(item));
        }
      });
    } else {
      formData.append(key, JSON.stringify(value));
    }
  });
  
  return formData;
}

export function parseFormDataValue(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

// Define the function tool for structured output
export const getDiagnosisTools = () => {
  return [
    {
      function_declarations: [
            {
              name: "plant_diagnosis",
              description: "Diagnose plant issues and provide brief explanations, treatment and prevention tips. Include programmer humor.",
              parameters: {
                type: "object",
                properties: {
                  plant: { type: "string", description: "Name of the plant in the pictures. In general, use the format 'common name (scientific name)'. For plants where the an average person somewhat familiar with plants would know the scientific name, use just the scientific name. E.g., for Monstera Deliciosa, reply 'Monstera Deliciosa' and not 'Swiss Cheese Plant (Monstera Deliciosa)'. If the user provided the name of the plant, verify it is correct. If it's not, provide the name of the plant that you identify from the pictures. Only provide the name of the plant and nothing else." },
                  primaryDiagnosis: { type: "string", description: "Most likely (primary) diagnosis based on the pictures and context." },
                  primaryConfidence: { type: "string", enum: ["High", "Medium", "Low"], description: "Confidence level in the primary diagnosis. Rate your confidence in your diagnosis realistically given the available information." },
                  primaryReasoning: { type: "string", description: "Brief explanation of how the primary diagnosis was reached, referencing visual evidence and user context, in Markdown. Maximum 2 sentences." },
                  primaryTreatmentPlan: { type: "string", description: "Brief step-by-step guide for the user to resolve the issue in case of the primary diagnosis, in Markdown. Maximum 3 bullet points." },
                  primaryPreventionTips: { type: "string", description: "Brief actionable advice to prevent recurrence in case of the primary diagnosis, in Markdown. Maximum 3 bullet points." },
                  primarySummary: { type: "string", description: "Summary of the reasoning, treatment plan, and prevention tips for the primary diagnosis, in Markdown. Maximum 3-4 bullet points. Including programming humor." },
                  secondaryDiagnosis: { type: "string", description: "Secondary diagnosis in case there is another likely possibility of what the issue with the plant could be, other than the primary diagnosis." },
                  secondaryConfidence: { type: "string", enum: ["High", "Medium", "Low"], description: "Confidence level in the secondary diagnosis." },
                  secondaryReasoning: { type: "string", description: "Brief explanation of how the secondary diagnosis was reached, referencing visual evidence and user context, in Markdown. Maximum 2 sentences." },
                  secondaryTreatmentPlan: { type: "string", description: "Brief step-by-step guide for the user to resolve the issue in case of the secondary diagnosis, in Markdown. Maximum 3 bullet points." },
                  secondaryPreventionTips: { type: "string", description: "Brief actionable advice to prevent recurrence in case of the secondary diagnosis, in Markdown. Maximum 3 bullet points." },
                  secondarySummary: { type: "string", description: "Summary of the reasoning, treatment plan, and prevention tips for the secondary diagnosis, in Markdown. Maximum 3-4 bullet points. Including programming humor." },
                  careTips: { type: "string", description: "Provide general care tips and best practices specific for the user's plant and the plant's situation as seen on the pictures, such as optimal light conditions, optimal soil type, watering schedule, fertilizer use, etc., in Markdown. Maximum 5-10 bullet points. Including programming humor." }
                },
                required: ["plant", "primaryDiagnosis", "primaryConfidence", "primaryReasoning", "primaryTreatmentPlan", "primaryPreventionTips", "primarySummary", "careTips"]
              }
            }
          ]

    }
  ] as unknown as import('@google/generative-ai').Tool[];
};


export const getDiagnosisQuestions = () => {
  return [
    {
      function_declarations: [
            {
              name: "generate_questions",
              description: "Generate 3-5 short yes/no questions to help narrow down a plant diagnosis.",
              parameters: {
                type: "object",
                properties: {
                  Q1: { type: "string", description: "Short yes/no question to help narrow down a plant diagnosis." },
                  Q2: { type: "string", description: "Short yes/no question to help narrow down a plant diagnosis." },
                  Q3: { type: "string", description: "Short yes/no question to help narrow down a plant diagnosis." },
                  Q4: { type: "string", description: "Short yes/no question to help narrow down a plant diagnosis." },
                  Q5: { type: "string", description: "Short yes/no question to help narrow down a plant diagnosis." }
                },
                required: ["Q1", "Q2"]
              }
            }
          ]

    }
  ] as unknown as import('@google/generative-ai').Tool[];
};

