'use client';

// Simple session-scoped memory for which strings have been typed already
const typedKeys = new Set<string>();

export const typingSession = {
  has(key: string) {
    return typedKeys.has(key);
  },
  add(key: string) {
    typedKeys.add(key);
  },
  reset() {
    typedKeys.clear();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('typing:reset'));
    }
  },
};

export default typingSession;
