/// <reference types="jest" />
import { render, screen, act } from '@testing-library/react';
import TypingText from '@/components/ui/TypingText';

function mockReducedMotion(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? matches : false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

describe('TypingText', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('types text gradually by default', () => {
    mockReducedMotion(false);
    jest.useFakeTimers();
    render(<TypingText text="Hello world" onceKey={`t-${Math.random()}`} />);
    // before the start delay nothing is shown
    expect(screen.queryByText('Hello world')).not.toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders instantly under prefers-reduced-motion', () => {
    mockReducedMotion(true);
    jest.useFakeTimers();
    const onComplete = jest.fn();
    render(
      <TypingText
        text="Instant text"
        onceKey={`t-${Math.random()}`}
        onComplete={onComplete}
      />
    );
    // full text visible immediately, no typing interval needed
    expect(screen.getByText('Instant text')).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(10);
    });
    expect(onComplete).toHaveBeenCalled();
  });
});
