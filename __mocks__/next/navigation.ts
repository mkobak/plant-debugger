// Manual Jest mock for next/navigation (App Router) used in tests
// Provides a singleton router so tests and hooks share the same instance

const router = {
  push: jest.fn(),
  prefetch: jest.fn(),
  replace: jest.fn(),
  refresh: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
};

export const useRouter = () => router;

// Test-only handle to inspect/reset the singleton router
export const __router = router;

export default {};
