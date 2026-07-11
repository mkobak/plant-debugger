/// <reference types="jest" />
import { describe, it, expect } from '@jest/globals';
import {
  validateImages,
  validateTextFields,
  ValidationError,
  MAX_IMAGE_BYTES,
} from '@/lib/api/validation';

const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0];
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a];

function fakeFile(bytes: number[], type: string, size?: number): File {
  const u8 = new Uint8Array(bytes);
  return {
    size: size ?? u8.length,
    type,
    slice: (start: number, end: number) => ({
      arrayBuffer: async () => u8.slice(start, end).buffer,
    }),
  } as unknown as File;
}

describe('validateImages', () => {
  it('accepts valid jpeg and png files', async () => {
    await expect(
      validateImages([
        fakeFile(JPEG_HEAD, 'image/jpeg'),
        fakeFile(PNG_HEAD, 'image/png'),
      ])
    ).resolves.toBeUndefined();
  });

  it('rejects empty input', async () => {
    await expect(validateImages([])).rejects.toThrow(ValidationError);
  });

  it('rejects more than 3 files', async () => {
    const files = Array.from({ length: 4 }, () =>
      fakeFile(JPEG_HEAD, 'image/jpeg')
    );
    await expect(validateImages(files)).rejects.toThrow(/Too many images/);
  });

  it('rejects oversized files', async () => {
    const big = fakeFile(JPEG_HEAD, 'image/jpeg', MAX_IMAGE_BYTES + 1);
    await expect(validateImages([big])).rejects.toThrow(/too large/);
  });

  it('rejects disallowed MIME types', async () => {
    await expect(
      validateImages([fakeFile([0x25, 0x50], 'application/pdf')])
    ).rejects.toThrow(/Unsupported image type/);
  });

  it('rejects files whose content does not match their MIME type', async () => {
    // text content claiming to be a jpeg (renamed .txt attack)
    const disguised = fakeFile([0x68, 0x65, 0x6c, 0x6c], 'image/jpeg');
    await expect(validateImages([disguised])).rejects.toThrow(/does not match/);
  });
});

describe('validateTextFields', () => {
  it('accepts fields within limits', () => {
    expect(() =>
      validateTextFields({
        userComment: 'a'.repeat(2000),
        questionsAndAnswers: 'b'.repeat(4000),
        rankedDiagnoses: 'c'.repeat(1000),
      })
    ).not.toThrow();
  });

  it('rejects over-limit fields', () => {
    expect(() => validateTextFields({ userComment: 'a'.repeat(2001) })).toThrow(
      /userComment too long/
    );
    expect(() =>
      validateTextFields({ questionsAndAnswers: 'a'.repeat(4001) })
    ).toThrow(/questionsAndAnswers too long/);
    expect(() =>
      validateTextFields({ rankedDiagnoses: 'a'.repeat(1001) })
    ).toThrow(/rankedDiagnoses too long/);
  });

  it('ignores absent fields', () => {
    expect(() => validateTextFields({})).not.toThrow();
  });
});
