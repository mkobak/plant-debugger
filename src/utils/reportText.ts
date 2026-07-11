import { DiagnosisResult } from '@/types';

/** Formats a completed diagnosis as shareable plain-text markdown. */
export function formatReportAsMarkdown(result: DiagnosisResult): string {
  const lines: string[] = [];
  if (result.plant) lines.push(`# Plant Debugger report: ${result.plant}`, '');

  const section = (
    title: string,
    d: DiagnosisResult['primary'] | undefined
  ) => {
    if (!d) return;
    lines.push(
      `## ${title}: ${d.condition}`,
      `Confidence: ${d.confidence}`,
      '',
      '### Summary',
      d.summary,
      '',
      '### Reasoning',
      d.reasoning,
      '',
      '### Treatment plan',
      d.treatment,
      '',
      '### Prevention tips',
      d.prevention,
      ''
    );
  };

  section('Bug detected', result.primary);
  section('Another possible bug', result.secondary);

  lines.push('## Care tips', result.careTips, '');
  return lines.join('\n');
}
