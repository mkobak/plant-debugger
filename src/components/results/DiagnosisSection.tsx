import { DiagnosisResult } from '@/types';
import { formatWithMarkdown } from '@/utils/markdown';
import ConfidenceBadge from './ConfidenceBadge';

interface DiagnosisSectionProps {
  /** e.g. "Bug detected:" or "Another possible bug:" */
  title: string;
  diagnosis: DiagnosisResult['primary'];
  expanded: boolean;
  onToggle: () => void;
}

/** One diagnosis block: condition, confidence, summary, expandable details. */
export default function DiagnosisSection({
  title,
  diagnosis,
  expanded,
  onToggle,
}: DiagnosisSectionProps) {
  return (
    <>
      <div className="result-section report-block">
        <div>{`${title} ${diagnosis.condition}`}</div>
        <ConfidenceBadge confidence={diagnosis.confidence} />
      </div>

      <div className="result-section report-block">
        <div>{'Summary:'}</div>
        <div className="summary-content">
          <div
            dangerouslySetInnerHTML={{
              __html: formatWithMarkdown(diagnosis.summary),
            }}
          />
        </div>
        <button className="detail-button" onClick={onToggle}>
          {expanded ? 'Collapse' : 'Expand'} Details
        </button>

        {expanded && (
          <div className="detailed-section" style={{ marginTop: '-1px' }}>
            {(
              [
                ['Reasoning:', diagnosis.reasoning],
                ['Treatment Plan:', diagnosis.treatment],
                ['Prevention Tips:', diagnosis.prevention],
              ] as const
            ).map(([label, text]) => (
              <div key={label} className="diagnosis-subsection">
                <div className="summary-content-title">{label}</div>
                <div className="summary-content">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: formatWithMarkdown(text),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
