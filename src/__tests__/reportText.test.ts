/// <reference types="jest" />
import { describe, it, expect } from '@jest/globals';
import { formatReportAsMarkdown } from '@/utils/reportText';

const base = {
  plant: 'Monstera Deliciosa',
  primary: {
    condition: 'Root rot',
    confidence: 'High' as const,
    summary: '- **Cause:** wet soil',
    reasoning: 'Soil stays wet.',
    treatment: '- Repot',
    prevention: '- Better drainage',
  },
  careTips: '- **Light:** bright indirect',
};

describe('formatReportAsMarkdown', () => {
  it('includes plant, primary section and care tips', () => {
    const md = formatReportAsMarkdown(base);
    expect(md).toContain('# Plant Debugger report: Monstera Deliciosa');
    expect(md).toContain('## Bug detected: Root rot');
    expect(md).toContain('Confidence: High');
    expect(md).toContain('### Treatment plan');
    expect(md).toContain('## Care tips');
    expect(md).not.toContain('Another possible bug');
  });

  it('includes the secondary section when present', () => {
    const md = formatReportAsMarkdown({
      ...base,
      secondary: { ...base.primary, condition: 'Thrips', confidence: 'Low' },
    });
    expect(md).toContain('## Another possible bug: Thrips');
    expect(md).toContain('Confidence: Low');
  });
});
