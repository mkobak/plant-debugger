import { RefObject, useState } from 'react';
import { DiagnosisResult } from '@/types';
import { exportElementToSinglePagePdf } from '@/utils/domToPdf';
import { logger } from '@/lib/logger';

interface UseResultsExportProps {
  reportRef: RefObject<HTMLDivElement | null>;
  diagnosisResult: DiagnosisResult | null;
  /** Expand all collapsible sections for the snapshot; returns a restore fn. */
  expandAllSections: () => () => void;
}

/** PDF export of the results report: waits for images, expands sections,
 *  snapshots, then restores the previous UI state. */
export function useResultsExport({
  reportRef,
  diagnosisResult,
  expandAllSections,
}: UseResultsExportProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleDownload = async () => {
    if (!diagnosisResult || !reportRef.current) return;
    try {
      setIsExporting(true);
      const ts = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
      const plant = (diagnosisResult.plant || 'plant').replace(
        /[^a-z0-9_-]+/gi,
        '_'
      );
      const root = reportRef.current;
      // Ensure all images inside root are loaded before snapshot
      const imgs = Array.from(
        root.querySelectorAll('img')
      ) as HTMLImageElement[];
      await Promise.all(
        imgs.map((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise((res) => {
                img.addEventListener('load', res, { once: true });
                img.addEventListener('error', res, { once: true });
              })
        )
      );
      const restoreSections = expandAllSections();
      // Wait for state flush
      await new Promise((r) => setTimeout(r, 50));
      root.classList.add('report-exporting');
      await exportElementToSinglePagePdf({
        element: root,
        fileName: `diagnosis-${plant}-${ts}.pdf`,
      });
      root.classList.remove('report-exporting');
      restoreSections();
    } catch (e) {
      logger.error('Failed to generate report', e);
      alert('Failed to generate report. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return { isExporting, handleDownload };
}
