'use client';

import { useState, useEffect } from 'react';
import TerminalLayout from '@/components/layout/TerminalLayout';
import SharedHeader from '@/components/layout/SharedHeader';
import TypingText from '@/components/ui/TypingText';
import Prompt from '@/components/ui/Prompt';
import ImageUpload from '@/components/ui/ImageUpload';
import ImagePreviewModal from '@/components/ui/ImagePreviewModal';
import ActionButton from '@/components/ui/ActionButton';
import { useDiagnosis } from '@/context/DiagnosisContext';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useNavigation } from '@/hooks/useNavigation';
import useConfirmReset from '@/hooks/useConfirmReset';
import { PlantImage } from '@/types';

export default function UploadPage() {
  const { goHome, goToQuestions } = useNavigation();
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string>('');
  const [titleComplete, setTitleComplete] = useState(false);
  const [codeComplete, setCodeComplete] = useState(false);
  const [tipComplete, setTipComplete] = useState(false);
  const [isNavigatingBack, setIsNavigatingBack] = useState(false);

  const [shouldNavigate, setShouldNavigate] = useState(false);

  const {
    images: contextImages,
    setImages: setContextImages,
    additionalComments,
    setAdditionalComments,
  } = useDiagnosis();
  const { requestReset, ResetConfirmModal } = useConfirmReset();

  const {
    images,
    isUploading,
    uploadProgress,
    processFiles,
    removeImage,
    canAddMore,
    remainingSlots,
  } = useImageUpload({
    initialImages: contextImages,
    onUploadComplete: (uploadedImages: PlantImage[]) => {
      console.log(
        'onUploadComplete called with',
        uploadedImages.length,
        'images'
      );
      setContextImages(uploadedImages);
      setError('');
    },
    onError: (errorMessage: string) => {
      console.log('Upload error:', errorMessage);
      setError(errorMessage);
    },
  });

  useEffect(() => {
    // If there are already images in context, assume user navigated back
    if (contextImages.length > 0) {
      setIsNavigatingBack(true);
      setTitleComplete(true);
      setCodeComplete(true);
      setTipComplete(true);
    }
  }, [contextImages.length]);

  // Handle navigation after context images are updated
  useEffect(() => {
    if (shouldNavigate && contextImages.length > 0) {
      console.log('Context images updated, navigating to questions...');
      setShouldNavigate(false);
      // Use a small delay to ensure context is fully updated
      setTimeout(() => {
        goToQuestions();
      }, 100);
    }
  }, [shouldNavigate, contextImages, goToQuestions]);

  const handleImagePreview = (image: PlantImage) => {
    setSelectedImageId(image.id);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedImageId(null);
  };

  const handleImageRemove = (imageId: string) => {
    removeImage(imageId);
    const updatedImages = images.filter((img) => img.id !== imageId);
    setContextImages(updatedImages);
  };

  const handleNext = async () => {
    console.log('handleNext called, images length:', images.length);

    if (images.length > 0) {
      console.log('Setting context images and preparing to navigate...');
      setContextImages(images);
      setShouldNavigate(true);
    } else {
      console.log('No images to proceed with');
    }
  };

  const handleReset = () => {
    console.log('handleReset called');
    requestReset();
  };

  const canProceed = images.length > 0 && !isUploading;

  const handleAddSampleImage = async () => {
    if (isUploading) return;
    try {
      const res = await fetch('/api/sample-image');
      if (!res.ok) {
        setError('No sample images available.');
        return;
      }
      const { url, filename } = await res.json();
      const imgRes = await fetch(url);
      if (!imgRes.ok) {
        setError('Failed to fetch sample image.');
        return;
      }
      const blob = await imgRes.blob();
      const fileName = filename || 'sample-image';
      const file = new File([blob], fileName, {
        type: blob.type || 'image/jpeg',
      });
      const dt = new DataTransfer();
      dt.items.add(file);
      await processFiles(dt.files);
      setError('');
    } catch (e) {
      console.error('Error adding sample image', e);
      setError('Failed to load sample image.');
    }
  };

  return (
    <TerminalLayout title="Plant Debugger">
      <SharedHeader
        currentStep={1}
        showNavigation={true}
        onLogoClick={requestReset}
      />
      <div className="upload-page">
        <div className="terminal-text">
          {!isNavigatingBack ? (
            <TypingText
              text="Upload photos of your plant."
              speed={150}
              onComplete={() => setTitleComplete(true)}
            />
          ) : (
            <div className="terminal-text-line">
              Upload photos of your plant.
            </div>
          )}
          {error && (
            <div className="error-message">
              <TypingText text={`ERROR: ${error}`} className="error-text" />
            </div>
          )}
          <div className="upload-tip">
            {titleComplete ? (
              !isNavigatingBack ? (
                <TypingText
                  text="Tip: For best results, upload clear, well-lit photos showing the whole plant and close-ups of any affected parts."
                  speed={200}
                  onComplete={() => setTipComplete(true)}
                />
              ) : (
                <div className="terminal-text-line">
                  Tip: For best results, upload clear, well-lit photos showing
                  the whole plant and close-ups of any affected parts.
                </div>
              )
            ) : (
              <div className="upload-tip-placeholder" />
            )}
          </div>
          {tipComplete && (
            <>
              {/* Prompt moved below instructional text and above upload box */}
              <div className="prompt-line">
                <Prompt path="~/upload" />
              </div>
              <ImageUpload
                images={images}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                canAddMore={canAddMore}
                remainingSlots={remainingSlots}
                onFilesSelected={processFiles}
                onImageRemove={handleImageRemove}
                onImagePreview={handleImagePreview}
              />
              <div className="additional-comments-section">
                Additional comments (optional):
                <div className="comments-container">
                  <textarea
                    value={additionalComments}
                    onChange={(e) => setAdditionalComments(e.target.value)}
                    className="comments-textarea"
                    placeholder="e.g., description of issue, pests seen, care changes, etc."
                    rows={3}
                  />
                </div>
              </div>
              {images.length === 0 && canAddMore && !isUploading && (
                <div className="sample-image-hint">
                  <span className="sample-image-text">
                    No sad plants around?{' '}
                  </span>
                  <button
                    type="button"
                    className="sample-image-link"
                    onClick={handleAddSampleImage}
                  >
                    Try the debugger with a sample image.
                  </button>
                </div>
              )}
              <div className="page-actions">
                <ActionButton
                  variant="reset"
                  onClick={() => {
                    handleReset();
                  }}
                >
                  Reset
                </ActionButton>
                <ActionButton
                  variant="primary"
                  disabled={!canProceed}
                  onClick={() => {
                    handleNext();
                  }}
                  className={images.length > 0 ? 'has-images' : ''}
                >
                  Next
                </ActionButton>
              </div>
            </>
          )}
        </div>
      </div>
      <ImagePreviewModal
        images={images}
        currentImageId={selectedImageId}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
      <ResetConfirmModal />
    </TerminalLayout>
  );
}
