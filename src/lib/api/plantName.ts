/**
 * Normalizes the identification model's free-text reply to a plant name.
 * Returns '' when the reply indicates no identifiable plant.
 */
export function normalizePlantName(text: string): string {
  const plantName = text.trim();
  const normalized = plantName.toLowerCase();
  if (
    !plantName ||
    /no\s+plant/.test(normalized) ||
    /not\s+a\s+plant/.test(normalized) ||
    /no\s+.*detected/.test(normalized) ||
    /multiple\s+plants?/.test(normalized) ||
    /cannot\s+(identify|determine)/.test(normalized) ||
    /unknown/.test(normalized)
  ) {
    return '';
  }
  return plantName;
}
