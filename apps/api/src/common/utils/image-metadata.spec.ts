import { describe, expect, it } from 'vitest';
import { stripImageMetadata } from './image-metadata';

function jpegSegment(marker: number, payload: Buffer): Buffer {
  const header = Buffer.alloc(4);
  header.writeUInt16BE(0xff00 | marker, 0);
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([header, payload]);
}

function exifWithOrientation(orientation: number): Buffer {
  const tiff = Buffer.alloc(26);
  tiff.write('II', 0, 'ascii');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x0112, 10);
  tiff.writeUInt16LE(3, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt16LE(orientation, 18);
  return Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
}

const SOI = Buffer.from([0xff, 0xd8]);
const SCAN = Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9]);

function pngChunk(type: string, payload: string): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length, 0);
  return Buffer.concat([length, Buffer.from(type), Buffer.from(payload), Buffer.alloc(4)]);
}

function webpChunk(type: string, payload: Buffer): Buffer {
  const size = Buffer.alloc(4);
  size.writeUInt32LE(payload.length, 0);
  const pad = payload.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0);
  return Buffer.concat([Buffer.from(type), size, payload, pad]);
}

describe('stripImageMetadata', () => {
  it('drops JPEG EXIF and comments but keeps JFIF and the image data', () => {
    const jfif = jpegSegment(0xe0, Buffer.from('JFIF\0'));
    const input = Buffer.concat([
      SOI,
      jfif,
      jpegSegment(0xe1, Buffer.from('Exif\0\0lat=12.97,lon=77.59')),
      jpegSegment(0xfe, Buffer.from('taken by phone 123')),
      SCAN,
    ]);
    const output = stripImageMetadata(input, 'image/jpeg');
    expect(output).toEqual(Buffer.concat([SOI, jfif, SCAN]));
  });

  it('keeps only the orientation when the EXIF rotated the photo', () => {
    const input = Buffer.concat([SOI, jpegSegment(0xe1, exifWithOrientation(6)), SCAN]);
    const output = stripImageMetadata(input, 'image/jpeg');
    expect(output).not.toBeNull();
    const text = output?.toString('binary') ?? '';
    expect(text).toContain('Exif\0\0MM');
    expect(output?.subarray(0, 2)).toEqual(SOI);
    expect(output?.subarray(-SCAN.length)).toEqual(SCAN);
    // Orientation value 6, big-endian, inside the minimal IFD.
    expect(output?.readUInt16BE(2 + 10 + 18)).toBe(6);
  });

  it('rejects a JPEG with a broken segment length', () => {
    const input = Buffer.concat([SOI, Buffer.from([0xff, 0xe1, 0xff, 0xff, 0x00])]);
    expect(stripImageMetadata(input, 'image/jpeg')).toBeNull();
  });

  it('drops PNG text and EXIF chunks', () => {
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdr = pngChunk('IHDR', 'header-bytes!');
    const idat = pngChunk('IDAT', 'pixels');
    const iend = pngChunk('IEND', '');
    const input = Buffer.concat([
      signature,
      ihdr,
      pngChunk('tEXt', 'Author\0Someone'),
      pngChunk('eXIf', 'gps'),
      idat,
      iend,
    ]);
    expect(stripImageMetadata(input, 'image/png')).toEqual(
      Buffer.concat([signature, ihdr, idat, iend]),
    );
  });

  it('drops WebP EXIF/XMP chunks, clears the VP8X flags and fixes the RIFF size', () => {
    const vp8x = webpChunk('VP8X', Buffer.from([0x0c, 0, 0, 0, 1, 0, 0, 1, 0, 0]));
    const image = webpChunk('VP8L', Buffer.from('pixel'));
    const body = Buffer.concat([
      vp8x,
      image,
      webpChunk('EXIF', Buffer.from('gps')),
      webpChunk('XMP ', Buffer.from('<x/>')),
    ]);
    const header = Buffer.alloc(12);
    header.write('RIFF', 0, 'ascii');
    header.writeUInt32LE(body.length + 4, 4);
    header.write('WEBP', 8, 'ascii');
    const output = stripImageMetadata(Buffer.concat([header, body]), 'image/webp');
    expect(output?.toString('binary')).not.toContain('EXIF');
    expect(output?.readUInt32LE(4)).toBe((output?.length ?? 0) - 8);
    expect(output?.[20]).toBe(0);
  });

  it('returns HEIC unchanged', () => {
    const heic = Buffer.from('....ftypheic-data');
    expect(stripImageMetadata(heic, 'image/heic')).toBe(heic);
  });
});
