export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic';

export const IMAGE_EXTENSIONS: Readonly<Record<ImageMimeType, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

const HEIC_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'mif1', 'msf1']);

/**
 * Detects the image type from its leading bytes. Uploads are trusted only by content,
 * never by the client's file name or declared type (BR-CMP-3).
 */
export function detectImageType(data: Buffer): ImageMimeType | null {
  if (data.length < 12) return null;
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  if (data.toString('ascii', 4, 8) === 'ftyp' && HEIC_BRANDS.has(data.toString('ascii', 8, 12))) {
    return 'image/heic';
  }
  return null;
}
