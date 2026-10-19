import { describe, expect, it } from 'vitest';
import { detectImageType } from './image-type';

const pad = (bytes: number[]) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)]);

describe('detectImageType', () => {
  it('recognizes JPEG, PNG, WebP and HEIC signatures', () => {
    expect(detectImageType(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(detectImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      'image/png',
    );
    expect(detectImageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(detectImageType(Buffer.from('\0\0\0\x18ftypheic\0\0\0\0'))).toBe('image/heic');
  });

  it('rejects other content even with an image-like name', () => {
    expect(
      detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')),
    ).toBeNull();
    expect(detectImageType(Buffer.from('%PDF-1.7 something'))).toBeNull();
    expect(detectImageType(Buffer.from([0xff]))).toBeNull();
  });
});
