'use client';

import { useEffect, useState } from 'react';
import TerminalLayout from '@/components/layout/TerminalLayout';
import SharedHeader from '@/components/layout/SharedHeader';
import ActionButton from '@/components/ui/ActionButton';
import DiagnosisSection from '@/components/results/DiagnosisSection';
import CareTips from '@/components/results/CareTips';
import {
  listHistoryEntries,
  deleteHistoryEntry,
  type HistoryEntry,
} from '@/lib/history';
import { useNavigation } from '@/hooks/useNavigation';

function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistoryPage() {
  const { goHome } = useNavigation();
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<
    Record<string, boolean>
  >({});
  const [expandedCare, setExpandedCare] = useState<Record<string, boolean>>({});
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null
  );

  // Auto-revert the delete confirmation after a moment
  useEffect(() => {
    if (!confirmingDeleteId) return;
    const timer = setTimeout(() => setConfirmingDeleteId(null), 3000);
    return () => clearTimeout(timer);
  }, [confirmingDeleteId]);

  useEffect(() => {
    listHistoryEntries().then(setEntries);
  }, []);

  const handleDelete = async (id: string) => {
    // First click arms the confirmation; second click deletes
    if (confirmingDeleteId !== id) {
      setConfirmingDeleteId(id);
      return;
    }
    setConfirmingDeleteId(null);
    await deleteHistoryEntry(id);
    setEntries((prev) => (prev || []).filter((e) => e.id !== id));
    if (openId === id) setOpenId(null);
  };

  return (
    <TerminalLayout title="Plant Debugger">
      <SharedHeader showNavigation={false} onLogoClick={goHome} />
      <div className="results-page">
        <div className="terminal-text">
          <p>Past diagnoses (stored on this device):</p>

          {entries === null && <p>Loading...</p>}
          {entries?.length === 0 && (
            <p>No past diagnoses yet. Finished reports will appear here.</p>
          )}

          <div className="history-list">
            {entries?.map((entry) => (
              <div key={entry.id} className="result-section report-block">
                <div className="history-entry-row">
                  <button
                    className="detail-button"
                    onClick={() =>
                      setOpenId(openId === entry.id ? null : entry.id)
                    }
                    aria-label={
                      openId === entry.id ? 'Collapse report' : 'Expand report'
                    }
                  >
                    {openId === entry.id ? '[-]' : '[+]'}
                  </button>
                  {entry.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.thumbnail}
                      alt=""
                      className="history-entry-thumb"
                    />
                  ) : (
                    <span className="history-entry-thumb--placeholder" />
                  )}
                  <span className="history-entry-text">
                    <span className="history-entry-date">
                      {formatDate(entry.createdAt)}
                    </span>
                    {entry.plant} — {entry.diagnosisResult.primary.condition}
                  </span>
                  <button
                    className="text-action"
                    onClick={() => handleDelete(entry.id)}
                    aria-label={`Delete report from ${formatDate(entry.createdAt)}`}
                  >
                    {confirmingDeleteId === entry.id ? 'Confirm?' : 'Delete'}
                  </button>
                </div>

                {openId === entry.id && (
                  <div style={{ marginTop: '8px' }}>
                    <DiagnosisSection
                      title="Bug detected:"
                      diagnosis={entry.diagnosisResult.primary}
                      expanded={!!expandedDetails[entry.id]}
                      onToggle={() =>
                        setExpandedDetails((p) => ({
                          ...p,
                          [entry.id]: !p[entry.id],
                        }))
                      }
                    />
                    {entry.diagnosisResult.secondary && (
                      <DiagnosisSection
                        title="Another possible bug:"
                        diagnosis={entry.diagnosisResult.secondary}
                        expanded={!!expandedDetails[`${entry.id}-2`]}
                        onToggle={() =>
                          setExpandedDetails((p) => ({
                            ...p,
                            [`${entry.id}-2`]: !p[`${entry.id}-2`],
                          }))
                        }
                      />
                    )}
                    <CareTips
                      careTips={entry.diagnosisResult.careTips}
                      expanded={!!expandedCare[entry.id]}
                      onToggle={() =>
                        setExpandedCare((p) => ({
                          ...p,
                          [entry.id]: !p[entry.id],
                        }))
                      }
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="page-actions">
            <ActionButton variant="reset" onClick={goHome}>
              Home
            </ActionButton>
          </div>
        </div>
      </div>
    </TerminalLayout>
  );
}
