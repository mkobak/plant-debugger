/// <reference types="jest" />
import { describe, it, expect } from '@jest/globals';
import { imagesSignature, isValidImageFile } from '@/utils';

describe('imagesSignature', () => {
  it('joins image ids in order', () => {
    expect(imagesSignature([{ id: 'a' }, { id: 'b' }, { id: 'c' }])).toBe(
      'a|b|c'
    );
  });

  it('returns empty string for no images', () => {
    expect(imagesSignature([])).toBe('');
  });

  it('changes when order changes', () => {
    expect(imagesSignature([{ id: 'a' }, { id: 'b' }])).not.toBe(
      imagesSignature([{ id: 'b' }, { id: 'a' }])
    );
  });
});

describe('isValidImageFile', () => {
  it('accepts allowed types within the size limit', () => {
    const f = new File([new Uint8Array(10)], 'a.jpg', { type: 'image/jpeg' });
    expect(isValidImageFile(f)).toBe(true);
  });

  it('rejects disallowed types', () => {
    const f = new File([new Uint8Array(10)], 'a.gif', { type: 'image/gif' });
    expect(isValidImageFile(f)).toBe(false);
  });
});
