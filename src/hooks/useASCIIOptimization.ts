import { useEffect, RefObject } from 'react';

/**
 * Hook to optimize ASCII art rendering on mobile devices, especially Android Chrome
 * @param elementRef - Ref to the element containing ASCII art
 * @param dependencies - Additional dependencies to trigger re-optimization
 */
export function useASCIIOptimization(
  elementRef: RefObject<HTMLElement>,
  dependencies: unknown[] = []
) {
  useEffect(() => {
    const optimizeASCIIForMobile = () => {
      if (elementRef.current && window.innerWidth <= 768) {
        const isAndroid = /Android/i.test(navigator.userAgent);
        const isChrome = /Chrome/i.test(navigator.userAgent);
        
        if (isAndroid && isChrome) {
          // Apply additional optimizations for Android Chrome
          const element = elementRef.current;
          
          // Slight scale adjustment to improve character alignment
          element.style.transform = 'scale(0.99)';
          element.style.transformOrigin = 'top left';
          
          // Force font rendering optimization
          element.style.setProperty('-webkit-font-smoothing', 'none');
          element.style.setProperty('-moz-osx-font-smoothing', 'unset');
          
          // Ensure pixel-perfect rendering
          element.style.willChange = 'transform';
          
          // Force hardware acceleration
          element.style.setProperty('-webkit-transform', 'translateZ(0)');
          element.style.setProperty('-webkit-backface-visibility', 'hidden');
          element.style.backfaceVisibility = 'hidden';
        }
      }
    };

    // Apply optimizations initially
    setTimeout(optimizeASCIIForMobile, 10);
    
    // Reapply on window resize with debouncing
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(optimizeASCIIForMobile, 100);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [...dependencies]);
}
