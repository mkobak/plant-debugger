import { useRouter } from 'next/navigation';
import { useDiagnosis } from '@/context/DiagnosisContext';

export function useNavigation() {
  const router = useRouter();
  const { images, resetAll } = useDiagnosis();

  // Guarded navigation: Only rely on presence of data, not a separate step machine
  const push = (path: string) => router.push(path);

  const goHome = () => {
    resetAll();
    router.push('/');
  };

  const goToUpload = () => {
    push('/upload');
  };

  const goToQuestions = () => {
    if (images.length > 0) push('/analysis');
    else push('/upload');
  };

  const goToResults = () => {
    if (images.length > 0) push('/results');
    else push('/upload');
  };

  // Navigation UI helper: enable steps based on available data only
  const canNavigateToStep = (step: number) => {
    if (step === 1) return true;
    if (step >= 2) return images.length > 0;
    return false;
  };

  return {
    goHome,
    goToUpload,
    goToQuestions,
    goToResults,
    canNavigateToStep,
  };
}
