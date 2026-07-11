/// <reference types="jest" />
import { describe, it, expect } from '@jest/globals';
import { extractCompleteFields } from '@/utils/partialJson';

describe('extractCompleteFields', () => {
  it('returns nothing for an empty or opening-only buffer', () => {
    expect(extractCompleteFields('')).toEqual({});
    expect(extractCompleteFields('{')).toEqual({});
    expect(extractCompleteFields('{"plant"')).toEqual({});
  });

  it('excludes the field still being streamed', () => {
    const partial = '{"plant": "Monstera", "primaryDiagnosis": "Root r';
    expect(extractCompleteFields(partial)).toEqual({ plant: 'Monstera' });
  });

  it('includes a field once its value is terminated by a comma', () => {
    const partial = '{"plant": "Monstera", "primaryDiagnosis": "Root rot",';
    expect(extractCompleteFields(partial)).toEqual({
      plant: 'Monstera',
      primaryDiagnosis: 'Root rot',
    });
  });

  it('includes the last field when the object closes', () => {
    const full = '{"plant": "Monstera", "careTips": "- Water less"}';
    expect(extractCompleteFields(full)).toEqual({
      plant: 'Monstera',
      careTips: '- Water less',
    });
  });

  it('unescapes JSON string escapes (newlines, quotes)', () => {
    const partial =
      '{"primarySummary": "- **Cause:** wet soil\\n- Said \\"drainage\\"", "x": "y"}';
    expect(extractCompleteFields(partial).primarySummary).toBe(
      '- **Cause:** wet soil\n- Said "drainage"'
    );
  });

  it('does not treat an escaped quote as a terminator', () => {
    const partial = '{"a": "before \\" after';
    expect(extractCompleteFields(partial)).toEqual({});
  });

  it('handles null-valued fields by skipping them', () => {
    const partial = '{"secondaryDiagnosis": null, "careTips": "tips",';
    expect(extractCompleteFields(partial)).toEqual({ careTips: 'tips' });
  });
});
