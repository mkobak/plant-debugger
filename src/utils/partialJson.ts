/**
 * Extracts completed top-level string fields from a partially streamed flat
 * JSON object. A field counts as complete only when its closing quote is
 * followed by a comma or the closing brace — the field still being streamed
 * is deliberately excluded so UI reveals never show half-written text.
 */
export function extractCompleteFields(
  jsonText: string
): Record<string, string> {
  const fields: Record<string, string> = {};
  const fieldRe =
    /"([A-Za-z][A-Za-z0-9_]*)"\s*:\s*"((?:[^"\\]|\\.)*)"\s*(?=,|\})/g;
  let match;
  while ((match = fieldRe.exec(jsonText)) !== null) {
    try {
      fields[match[1]] = JSON.parse(`"${match[2]}"`);
    } catch {
      // skip fields whose escapes don't parse yet
    }
  }
  return fields;
}
