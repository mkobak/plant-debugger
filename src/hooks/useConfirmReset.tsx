'use client';

import { useState, useCallback, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import ActionButton from '@/components/ui/ActionButton';
import { useDiagnosis } from '@/context/DiagnosisContext';
import { useNavigation } from '@/hooks/useNavigation';

/**
 * Provides a confirmation modal for resetting. Only confirms when user has progress.
 */
export function useConfirmReset() {
  const {
    images,
    answers,
    questions,
    plantIdentification,
    diagnosisResult,
    additionalComments,
    noPlantMessage,
  } = useDiagnosis();
  const { goHome } = useNavigation();
  const [open, setOpen] = useState(false);

  const hasProgress = useMemo(
    () =>
      images.length > 0 ||
      answers.length > 0 ||
      questions.length > 0 ||
      !!plantIdentification ||
      !!diagnosisResult ||
      !!additionalComments.trim() ||
      !!noPlantMessage.trim(),
    [
      images.length,
      answers.length,
      questions.length,
      plantIdentification,
      diagnosisResult,
      additionalComments,
      noPlantMessage,
    ]
  );

  const requestReset = useCallback(() => {
    if (hasProgress) setOpen(true);
    else goHome();
  }, [hasProgress, goHome]);

  const confirmReset = useCallback(() => {
    goHome();
    setOpen(false);
  }, [goHome]);

  const cancelReset = useCallback(() => setOpen(false), []);

  const ResetConfirmModal = () => (
    <Modal isOpen={open} onClose={cancelReset} title="Confirm Reset" size="sm">
      <div className="reset-confirm-modal">
        <p>Resetting will discard all progress.</p>
        <div className="page-actions" style={{ marginTop: '1rem' }}>
          <ActionButton variant="secondary" onClick={cancelReset}>
            Cancel
          </ActionButton>
          <ActionButton variant="reset" onClick={confirmReset}>
            Confirm
          </ActionButton>
        </div>
      </div>
    </Modal>
  );

  return { requestReset, ResetConfirmModal, hasProgress };
}

export default useConfirmReset;
