import { type ImageMimeType } from './image-type';

/**
 * Removes embedded metadata (EXIF GPS location, camera serials, XMP, comments) from an uploaded
 * photo without re-encoding it, so a photo cannot reveal where or by whom it was taken
 * (BR-CMP-3, ADR-0028). Returns null when the file is malformed. HEIC is returned unchanged:
 * stripping it needs an image library (open question in ADR-0028); the app always sends JPEG.
 */
export function stripImageMetadata(data: Buffer, type: ImageMimeType): Buffer | null {
  if (type === 'image/jpeg') return stripJpeg(data);
  if (type === 'image/png') return stripPng(data);
  if (type === 'image/webp') return stripWebp(data);
  return data;
}

/** APP1 (EXIF/XMP), APP12–APP13 (Photoshop/IPTC) and COM; APP0, ICC (APP2) and Adobe (APP14) stay. */
const JPEG_DROPPED = new Set([0xe1, 0xec, 0xed, 0xfe]);
const JPEG_SOS = 0xda;

function stripJpeg(data: Buffer): Buffer | null {
  const parts: Buffer[] = [data.subarray(0, 2)];
  let offset = 2;
  let orientation = 1;
  while (offset + 4 <= data.length) {
    if (data[offset] !== 0xff) return null;
    const marker = data[offset + 1] ?? 0;
    if (marker === JPEG_SOS) {
      if (orientation !== 1) parts.splice(1, 0, orientationSegment(orientation));
      parts.push(data.subarray(offset));
      return Buffer.concat(parts);
    }
    const length = data.readUInt16BE(offset + 2);
    const end = offset + 2 + length;
    if (length < 2 || end > data.length) return null;
    const segment = data.subarray(offset, end);
    if (marker === 0xe1) orientation = readExifOrientation(segment) ?? orientation;
    if (!JPEG_DROPPED.has(marker)) parts.push(segment);
    offset = end;
  }
  return null;
}

/** Reads tag 0x0112 from IFD0, so dropping EXIF does not leave the photo sideways. */
function readExifOrientation(segment: Buffer): number | null {
  if (segment.toString('ascii', 4, 10) !== 'Exif\0\0') return null;
  const tiff = segment.subarray(10);
  if (tiff.length < 8) return null;
  const little = tiff.toString('ascii', 0, 2) === 'II';
  const u16 = (at: number) => (little ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at));
  const ifd = little ? tiff.readUInt32LE(4) : tiff.readUInt32BE(4);
  if (ifd + 2 > tiff.length) return null;
  const count = u16(ifd);
  for (let index = 0; index < count; index += 1) {
    const entry = ifd + 2 + index * 12;
    if (entry + 12 > tiff.length) return null;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : null;
    }
  }
  return null;
}

/** A minimal APP1 holding only the orientation tag (big-endian TIFF, one IFD0 entry). */
function orientationSegment(orientation: number): Buffer {
  const tiff = Buffer.alloc(26);
  tiff.write('MM', 0, 'ascii');
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4);
  tiff.writeUInt16BE(1, 8);
  tiff.writeUInt16BE(0x0112, 10);
  tiff.writeUInt16BE(3, 12); // SHORT
  tiff.writeUInt32BE(1, 14);
  tiff.writeUInt16BE(orientation, 18);
  tiff.writeUInt32BE(0, 22); // no next IFD
  const header = Buffer.alloc(10);
  header.writeUInt16BE(0xffe1, 0);
  header.writeUInt16BE(2 + 6 + tiff.length, 2);
  header.write('Exif\0\0', 4, 'ascii');
  return Buffer.concat([header, tiff]);
}

const PNG_DROPPED = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME']);

function stripPng(data: Buffer): Buffer | null {
  const parts: Buffer[] = [data.subarray(0, 8)];
  let offset = 8;
  while (offset + 12 <= data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.toString('ascii', offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > data.length) return null;
    if (!PNG_DROPPED.has(type)) parts.push(data.subarray(offset, end));
    offset = end;
    if (type === 'IEND') return Buffer.concat(parts);
  }
  return null;
}

const WEBP_DROPPED = new Set(['EXIF', 'XMP ']);
/** VP8X header flags for "has EXIF" and "has XMP". */
const VP8X_METADATA_FLAGS = 0x08 | 0x04;

function stripWebp(data: Buffer): Buffer | null {
  const chunks: Buffer[] = [];
  let offset = 12;
  while (offset + 8 <= data.length) {
    const type = data.toString('ascii', offset, offset + 4);
    const size = data.readUInt32LE(offset + 4);
    const end = offset + 8 + size + (size % 2);
    if (offset + 8 + size > data.length) return null;
    const chunk = Buffer.from(data.subarray(offset, Math.min(end, data.length)));
    if (type === 'VP8X' && chunk.length > 8) chunk[8] = (chunk[8] ?? 0) & ~VP8X_METADATA_FLAGS;
    if (!WEBP_DROPPED.has(type)) chunks.push(chunk);
    offset = end;
  }
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 'ascii');
  return Buffer.concat([header, body]);
}
