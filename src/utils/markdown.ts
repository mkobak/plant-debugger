/**
 * Minimal markdown-to-HTML formatting for model output.
 *
 * All input is HTML-escaped before any formatting, so the returned string is
 * safe to inject via dangerouslySetInnerHTML: only the tags produced here
 * (<p>, <div>, <span>, <strong>, <em>) can appear in the output.
 */

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatWithMarkdown(text: string): string {
  if (!text) return '';

  // Normalize line endings, then escape so raw HTML in model output is inert
  const normalized = escapeHtml(text.replace(/\r\n?/g, '\n').trim());

  // Helper to apply inline markdown formatting (bold/italic)
  const applyInlineMd = (s: string) =>
    s
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em>$1</em>');

  const processed: string[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    processed.push(
      `<div class="custom-bullet-list">${bulletBuffer
        .map(
          (b) =>
            `<div class="custom-bullet-item"><span class="bullet-symbol">*</span><span class="bullet-content">${applyInlineMd(
              b
            )}</span></div>`
        )
        .join('')}</div>`
    );
    bulletBuffer = [];
  };

  // Split into lines first
  const rawLines = normalized.split('\n');

  // Regex to split inline collapsed bullets where the model outputs: "- **Light:** ... - **Watering:** ..."
  // Allows an optional markdown bold/underline wrapper before the capitalized word.
  // Split points for inline collapsed bullets. Handles:
  // 1. " - **Light:**" (space-hyphen-space)
  // 2. ".- **Watering:**" (period directly before hyphen, model sometimes omits space)
  // 3. Similar after ! or ?
  const inlineBulletSplit =
    /(?:\s-\s+|(?<=[.!?])-\s+)(?=(?:\*\*|__)?[A-Z0-9])/g;

  rawLines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushBullets();
      return; // skip empty
    }

    const bulletLine = /^[-*•]\s+/.test(line);

    if (bulletLine) {
      // Remove initial bullet marker
      const content = line.replace(/^[-*•]\s+/, '').trim();

      const inlineSplitter = new RegExp(inlineBulletSplit.source, 'g');

      let parts = [content];

      // If we detect ANY inline bullet boundary (space-hyphen-space OR punctuation-hyphen-space), split.
      if (inlineSplitter.test(content)) {
        const splitParts = content
          .split(new RegExp(inlineBulletSplit.source, 'g'))
          .map((p) => p.trim());
        if (splitParts.length > 1 && splitParts.every((p) => p.length > 2)) {
          parts = splitParts;
        }
      }

      // Secondary fallback: if still one part, but we have at least two occurrences of punctuation-hyphen or space-hyphen patterns followed by capital, attempt split.
      if (parts.length === 1) {
        const boundaryMatches = content.match(
          /(?:\s-|[.!?]-)\s+(?:\*\*|__)?[A-Z0-9]/g
        );
        if (boundaryMatches && boundaryMatches.length >= 2) {
          parts = content
            .split(new RegExp(inlineBulletSplit.source, 'g'))
            .map((p) => p.trim());
        }
      }

      parts.forEach((p) => p && bulletBuffer.push(p));
    } else {
      // If the line isn't marked as a bullet but contains multiple inline hyphen bullets starting with '* ' pattern earlier
      // Attempt detection for asterisk-start style collapsed into one line (edge case)
      if (/^\*/.test(line) && line.includes(' - ')) {
        // Remove initial '*'
        const afterStar = line.replace(/^\*\s*/, '').trim();
        const candidateParts = afterStar
          .split(inlineBulletSplit)
          .map((p) => p.trim());
        if (candidateParts.length > 1) {
          bulletBuffer.push(candidateParts[0]);
          candidateParts.slice(1).forEach((p) => bulletBuffer.push(p));
          return; // treat whole line as bullet list
        }
      }

      // General fallback: detect lines with multiple inline dashes that look like bullets even if line doesn't start with a bullet marker.
      // Example: "Summary: - **Cause:** ... - **Effect:** ... - **Fix:** ..."
      if (line.includes(' - ')) {
        const occurrences = line.match(/(?:^|\s)-\s+(?:\*\*|__)?[A-Z0-9]/g);
        if (occurrences && occurrences.length >= 2) {
          // Split prelude (text before first dash) from bullet portion
          const firstDash = line.indexOf(' - ');
          const prelude = line.slice(0, firstDash).trim();
          const bulletsSegment = line.slice(firstDash).trim();
          if (prelude) {
            flushBullets(); // End any previous list before heading paragraph
            processed.push(`<p>${applyInlineMd(prelude)}</p>`);
          }
          const listParts = bulletsSegment
            .replace(/^-\s+/, '')
            .split(inlineBulletSplit)
            .map((p) => p.trim())
            .filter(Boolean);
          if (listParts.length > 1) {
            listParts.forEach((p) => bulletBuffer.push(p));
            return; // Defer flushing to allow subsequent bullet lines to join
          }
        }
      }

      // Not a bullet line
      flushBullets();
      processed.push(`<p>${applyInlineMd(line)}</p>`);
    }
  });

  flushBullets();

  return processed.join('');
}
