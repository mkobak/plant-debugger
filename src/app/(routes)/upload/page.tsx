'use client';

import { useState, useEffect } from 'react';
import TerminalLayout from '@/components/layout/TerminalLayout';
import SharedHeader from '@/components/layout/SharedHeader';
import TypingText from '@/components/ui/TypingText';
import ImageUpload from '@/components/ui/ImageUpload';
import ImagePreviewModal from '@/components/ui/ImagePreviewModal';
import ActionButton from '@/components/ui/ActionButton';
import { useDiagnosis } from '@/context/DiagnosisContext';
import { useImageUpload } from '@/hooks/useImageUpload';
import { PlantImage } from '@/types';

export default function UploadPage() {
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string>('');
  const [titleComplete, setTitleComplete] = useState(false);
  const [tipComplete, setTipComplete] = useState(false);
  const { images: contextImages, setImages: setContextImages, setCurrentStep } = useDiagnosis();

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
      setContextImages(uploadedImages);
      setError('');
    },
    onError: (errorMessage: string) => {
      setError(errorMessage);
    },
  });

  useEffect(() => {
    setCurrentStep(1);
  }, [setCurrentStep]);

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
    const updatedImages = images.filter(img => img.id !== imageId);
    setContextImages(updatedImages);
  };

  const canProceed = images.length > 0 && !isUploading;

  return (
    <TerminalLayout title="plant-debugger:~/upload$">
      <SharedHeader currentStep={1} showNavigation={true} />
      <div className="upload-page">
        <div className="terminal-text">
          <TypingText
            text="> Upload photos of your plant."
            speed={80}
            onComplete={() => setTitleComplete(true)}
          />
          {error && (
            <div className="error-message">
              <TypingText
                text={`ERROR: ${error}`}
                className="error-text"
              />
            </div>
          )}
          {titleComplete && (
            <div className="upload-tip">
              <TypingText
                text="> Tip: For best results, upload clear, well-lit photos showing the whole plant and close-ups of any affected parts."
                speed={100}
                onComplete={() => setTipComplete(true)}
              />
            </div>
          )}
          {tipComplete && (
            <>
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
              <div className="page-actions">
                <ActionButton 
                  variant="reset"
                  href="/"
                >
                  [ Reset ]
                </ActionButton>
                <ActionButton
                  variant="primary"
                  disabled={!canProceed}
                  href="/questions"
                  className={images.length > 0 ? 'has-images' : ''}
                >
                  [ Next ]
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
        onImageRemove={handleImageRemove}
      />
    </TerminalLayout>
  );
}
