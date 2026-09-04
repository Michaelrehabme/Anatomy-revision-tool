/**
 * Minimal PNG decoder for the mask->hotspot pipeline.
 *
 * Hand-rolled rather than pulling in sharp/pngjs: the whole corpus is
 * non-interlaced 8-bit, decoding is ~40 lines on top of node:zlib, and sharp
 * in particular is a native build that would have to be installed on every
 * machine that ever regenerates hotspots for the sake of one script.
 */
import { readFileSync, openSync, readSync, closeSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CHANNELS_BY_COLOR_TYPE: Record<number, number> = {
  0: 1, // greyscale
  2: 3, // RGB
  4: 2, // greyscale + alpha
  6: 4, // RGBA
};

export interface DecodedPng {
  width: number;
  height: number;
  channels: number;
  /** Row-major, `channels` bytes per pixel, no per-scanline filter bytes. */
  data: Buffer;
}

/** Reads just the IHDR dimensions — 32 bytes, no inflate. */
export function readIhdrDimensions(path: string): { width: number; height: number } {
  const header = Buffer.alloc(32);
  const fd = openSync(path, 'r');
  try {
    readSync(fd, header, 0, 32, 0);
  } finally {
    closeSync(fd);
  }
  assertSignature(header, path);
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

export function decodePng(path: string): DecodedPng {
  const file = readFileSync(path);
  assertSignature(file, path);

  const width = file.readUInt32BE(16);
  const height = file.readUInt32BE(20);
  const bitDepth = file[24];
  const colorType = file[25];
  const interlace = file[28];

  if (bitDepth !== 8) {
    throw new Error(`${path}: bit depth ${bitDepth} unsupported (only 8-bit)`);
  }
  if (interlace !== 0) {
    throw new Error(`${path}: interlaced PNGs unsupported`);
  }
  const channels = CHANNELS_BY_COLOR_TYPE[colorType];
  if (!channels) {
    throw new Error(`${path}: colour type ${colorType} unsupported (palette PNGs need a PLTE pass)`);
  }

  const idat: Buffer[] = [];
  let offset = 8;
  while (offset < file.length - 8) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') idat.push(file.subarray(offset + 8, offset + 8 + length));
    if (type === 'IEND') break;
    offset += 12 + length;
  }
  if (idat.length === 0) throw new Error(`${path}: no IDAT chunks`);

  return {
    width,
    height,
    channels,
    data: reconstruct(inflateSync(Buffer.concat(idat)), width, height, channels),
  };
}

function assertSignature(buffer: Buffer, path: string): void {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${path}: not a PNG`);
  }
}

/**
 * Undoes the per-scanline filters. Each scanline is prefixed with a filter
 * type byte and predicts from the pixel to the left (a), above (b) and
 * above-left (c); output is written in place so later scanlines can read the
 * already-reconstructed row above them.
 */
function reconstruct(raw: Buffer, width: number, height: number, channels: number): Buffer {
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y++) {
    const filterType = raw[y * (stride + 1)];
    const lineStart = y * (stride + 1) + 1;

    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0;
      const value = raw[lineStart + x];

      let reconstructed: number;
      switch (filterType) {
        case 0: reconstructed = value; break;
        case 1: reconstructed = value + a; break;
        case 2: reconstructed = value + b; break;
        case 3: reconstructed = value + ((a + b) >> 1); break;
        case 4: reconstructed = value + paeth(a, b, c); break;
        default: throw new Error(`Unknown PNG filter type ${filterType} on scanline ${y}`);
      }
      out[y * stride + x] = reconstructed & 0xff;
    }
  }

  return out;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}
