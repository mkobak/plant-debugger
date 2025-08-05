'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TerminalLayout from '@/components/layout/TerminalLayout';
import SharedHeader from '@/components/layout/SharedHeader';
import TypingText from '@/components/ui/TypingText';
import ImageUpload from '@/components/ui/ImageUpload';
import ImagePreviewModal from '@/components/ui/ImagePreviewModal';
import ActionButton from '@/components/ui/ActionButton';
import { useDiagnosis } from '@/context/DiagnosisContext';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useNavigation } from '@/hooks/useNavigation';
import { PlantImage } from '@/types';

export default function UploadPage() {
  const router = useRouter();
  const { goHome, goToQuestions, maxReachedStep } = useNavigation();
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string>('');
  const [titleComplete, setTitleComplete] = useState(false);
  const [tipComplete, setTipComplete] = useState(false);
  const [isNavigatingBack, setIsNavigatingBack] = useState(false);
  
  const [shouldNavigate, setShouldNavigate] = useState(false);

  const { 
    images: contextImages, 
    setImages: setContextImages, 
    setCurrentStep, 
    setMaxReachedStep,
  } = useDiagnosis();

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
      console.log('onUploadComplete called with', uploadedImages.length, 'images');
      setContextImages(uploadedImages);
      setError('');
    },
    onError: (errorMessage: string) => {
      console.log('Upload error:', errorMessage);
      setError(errorMessage);
    },
  });

  useEffect(() => {
    setCurrentStep(1);
    
    // Check if we're navigating back (if step 2 or higher has been reached)
    if (maxReachedStep >= 2) {
      setIsNavigatingBack(true);
      setTitleComplete(true);
      setTipComplete(true);
    }
  }, [setCurrentStep, maxReachedStep]);

  // Handle navigation after context images are updated
  useEffect(() => {
    if (shouldNavigate && contextImages.length > 0) {
      console.log('Context images updated, navigating to questions...');
      setShouldNavigate(false);
      setMaxReachedStep(Math.max(maxReachedStep, 2));
      
      // Use a small delay to ensure context is fully updated
      setTimeout(() => {
        goToQuestions();
      }, 100);
    }
  }, [shouldNavigate, contextImages, maxReachedStep, goToQuestions, setMaxReachedStep]);

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
    goHome();
  };

  const canProceed = images.length > 0 && !isUploading;

  return (
    <TerminalLayout title="plant-debugger:~/upload$">
      <SharedHeader currentStep={1} showNavigation={true} />
      <div className="upload-page">
        <div className="terminal-text">
          {!isNavigatingBack ? (
            <TypingText
              text="> Upload photos of your plant."
              speed={100}
              onComplete={() => setTitleComplete(true)}
            />
          ) : (
            <div>&gt; Upload photos of your plant.</div>
          )}
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
              {!isNavigatingBack ? (
                <TypingText
                  text="> Tip: For best results, upload clear, well-lit photos showing the whole plant and close-ups of any affected parts."
                  speed={200}
                  onComplete={() => setTipComplete(true)}
                />
              ) : (
                <div>&gt; Tip: For best results, upload clear, well-lit photos showing the whole plant and close-ups of any affected parts.</div>
              )}
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
                <button 
                  className="action-button action-button--reset"
                  onClick={() => {
                    console.log('Reset button clicked');
                    handleReset();
                  }}
                >
                  [ Reset ]
                </button>
                <button
                  className={`action-button action-button--primary ${images.length > 0 ? 'has-images' : ''}`}
                  disabled={!canProceed}
                  onClick={() => {
                    console.log('Next button clicked');
                    handleNext();
                  }}
                >
                  [ Next ]
                </button>
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
