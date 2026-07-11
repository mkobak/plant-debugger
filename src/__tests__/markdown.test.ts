import { escapeHtml, formatWithMarkdown } from '@/utils/markdown';

describe('escapeHtml', () => {
  it('escapes all HTML-significant characters', () => {
    expect(escapeHtml(`<img src=x onerror=alert(1)> & "quotes" 'single'`)).toBe(
      '&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quotes&quot; &#39;single&#39;'
    );
  });
});

describe('formatWithMarkdown', () => {
  it('returns empty string for empty input', () => {
    expect(formatWithMarkdown('')).toBe('');
  });

  it('wraps plain lines in paragraphs', () => {
    expect(formatWithMarkdown('Hello world')).toBe('<p>Hello world</p>');
  });

  it('applies bold and italic', () => {
    expect(formatWithMarkdown('This is **bold** and *italic*')).toBe(
      '<p>This is <strong>bold</strong> and <em>italic</em></p>'
    );
  });

  it('renders hyphen bullets as a custom bullet list', () => {
    const html = formatWithMarkdown('- First item\n- Second item');
    expect(html).toContain('custom-bullet-list');
    expect(html).toContain('<span class="bullet-content">First item</span>');
    expect(html).toContain('<span class="bullet-content">Second item</span>');
  });

  it('splits inline collapsed bullets', () => {
    const html = formatWithMarkdown(
      '- **Light:** Bright indirect. - **Watering:** Weekly.'
    );
    const items = html.match(/custom-bullet-item/g) || [];
    expect(items.length).toBe(2);
  });

  it('neutralizes script tags from model output', () => {
    const html = formatWithMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('neutralizes img onerror payloads', () => {
    const html = formatWithMarkdown('Look: <img src=x onerror=alert(1)>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('neutralizes attribute-breaking quotes inside bullets', () => {
    const html = formatWithMarkdown('- Item with "quote" and \'tick\'');
    expect(html).not.toContain('"quote"');
    expect(html).toContain('&quot;quote&quot;');
    expect(html).toContain('&#39;tick&#39;');
  });

  it('still bolds text adjacent to escaped characters', () => {
    const html = formatWithMarkdown('**A & B**');
    expect(html).toBe('<p><strong>A &amp; B</strong></p>');
  });
});
