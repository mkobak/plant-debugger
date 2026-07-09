/// <reference types="jest" />
import { render, screen, fireEvent } from '@testing-library/react';
import DiagnosisSection from '@/components/results/DiagnosisSection';
import { getConfidenceColor } from '@/components/results/ConfidenceBadge';

const diagnosis = {
  condition: 'Root rot',
  confidence: 'High' as const,
  summary: 'Roots are **mushy**.',
  reasoning: 'Soil stays wet.',
  treatment: '- Repot\n- Water less',
  prevention: 'Better drainage.',
};

describe('DiagnosisSection', () => {
  it('renders title, condition and confidence', () => {
    render(
      <DiagnosisSection
        title="Bug detected:"
        diagnosis={diagnosis}
        expanded={false}
        onToggle={() => {}}
      />
    );
    expect(screen.getByText('Bug detected: Root rot')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Expand Details')).toBeInTheDocument();
    // details hidden while collapsed
    expect(screen.queryByText('Reasoning:')).not.toBeInTheDocument();
  });

  it('renders markdown-formatted details when expanded', () => {
    render(
      <DiagnosisSection
        title="Another possible bug:"
        diagnosis={diagnosis}
        expanded={true}
        onToggle={() => {}}
      />
    );
    expect(
      screen.getByText('Another possible bug: Root rot')
    ).toBeInTheDocument();
    expect(screen.getByText('Collapse Details')).toBeInTheDocument();
    expect(screen.getByText('Reasoning:')).toBeInTheDocument();
    expect(screen.getByText('Treatment Plan:')).toBeInTheDocument();
    expect(screen.getByText('Prevention Tips:')).toBeInTheDocument();
    // bold markdown in summary rendered as <strong>
    expect(screen.getByText('mushy').tagName).toBe('STRONG');
  });

  it('calls onToggle when the details button is clicked', () => {
    const onToggle = jest.fn();
    render(
      <DiagnosisSection
        title="Bug detected:"
        diagnosis={diagnosis}
        expanded={false}
        onToggle={onToggle}
      />
    );
    fireEvent.click(screen.getByText('Expand Details'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe('getConfidenceColor', () => {
  it('maps confidence levels to theme colors', () => {
    expect(getConfidenceColor('High')).toBe('var(--green)');
    expect(getConfidenceColor('Medium')).toBe('var(--orange)');
    expect(getConfidenceColor('Low')).toBe('var(--red)');
  });
});
