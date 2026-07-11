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

  it('does not restart typing when the parent re-renders with a new onComplete identity', () => {
    mockReducedMotion(false);
    jest.useFakeTimers();
    const key = `t-${Math.random()}`;
    const { rerender, container } = render(
      <TypingText
        text="Streaming resilient line"
        speed={100}
        delay={0}
        onceKey={key}
        onComplete={() => {}}
      />
    );
    // Let it type roughly half of the text
    act(() => {
      jest.advanceTimersByTime(120);
    });
    const midway = container.textContent || '';
    expect(midway.length).toBeGreaterThan(3);

    // Parent re-render with a fresh inline arrow — exactly what happens on
    // every streamed-field update on the results page
    rerender(
      <TypingText
        text="Streaming resilient line"
        speed={100}
        delay={0}
        onceKey={key}
        onComplete={() => {}}
      />
    );
    // If the effect restarted, the display would have reset to ''
    const afterRerender = container.textContent || '';
    expect(afterRerender.length).toBeGreaterThanOrEqual(midway.length);

    // And it still completes normally
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText('Streaming resilient line')).toBeInTheDocument();
  });

  it('uses the latest onComplete callback at completion time', () => {
    mockReducedMotion(false);
    jest.useFakeTimers();
    const first = jest.fn();
    const second = jest.fn();
    const key = `t-${Math.random()}`;
    const { rerender } = render(
      <TypingText
        text="Hi"
        speed={100}
        delay={0}
        onceKey={key}
        onComplete={first}
      />
    );
    rerender(
      <TypingText
        text="Hi"
        speed={100}
        delay={0}
        onceKey={key}
        onComplete={second}
      />
    );
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
