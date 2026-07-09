type Confidence = 'High' | 'Medium' | 'Low';

export function getConfidenceColor(confidence: Confidence): string {
  if (confidence === 'High') return 'var(--green)';
  if (confidence === 'Medium') return 'var(--orange)';
  return 'var(--red)';
}

export default function ConfidenceBadge({
  confidence,
}: {
  confidence: Confidence;
}) {
  return (
    <div className="confidence-indicator">
      <span className="confidence-text">{'Confidence: '}</span>
      <span
        className="confidence-value"
        style={{ color: getConfidenceColor(confidence) }}
      >
        {confidence}
      </span>
    </div>
  );
}
