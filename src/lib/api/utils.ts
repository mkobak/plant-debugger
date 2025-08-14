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
