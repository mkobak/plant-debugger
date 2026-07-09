import { formatWithMarkdown } from '@/utils/markdown';

interface CareTipsProps {
  careTips: string;
  expanded: boolean;
  onToggle: () => void;
}

export default function CareTips({
  careTips,
  expanded,
  onToggle,
}: CareTipsProps) {
  return (
    <div className="result-section report-block">
      <button className="detail-button" onClick={onToggle}>
        {expanded ? 'Hide' : 'Show'} Care Tips
      </button>

      {expanded && (
        <div className="care-section" style={{ marginTop: '-1px' }}>
          <div className="summary-content-title">Care Tips:</div>
          <div className="summary-content">
            <div
              dangerouslySetInnerHTML={{
                __html: formatWithMarkdown(careTips),
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
