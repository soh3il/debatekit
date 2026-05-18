/**
 * Minimal ID3v2.3 Tag Writer
 *
 * Builds an ID3v2.3 binary tag that can be prepended to raw MP3 audio.
 * Supports text frames (TIT2, TPE1, TALB, TRCK, TCOP, TYER, TCON)
 * and APIC (embedded cover art).
 *
 * No external dependencies — pure binary construction.
 */

// ============================================================================
// TYPES
// ============================================================================

type Id3ApicFrame = {
  data: Uint8Array;
  mimeType: string;
};

type Id3CommentFrame = {
  language?: string;
  text: string;
};

export type Id3TagOptions = {
  album?: string;
  artist?: string;
  comment?: Id3CommentFrame;
  copyright?: string;
  coverImage?: Id3ApicFrame;
  genre?: string;
  title: string;
  trackNumber?: number;
  year?: string;
};

// ============================================================================
// ENCODING HELPERS
// ============================================================================

const encoder = new TextEncoder();

function encodeUtf8(str: string): Uint8Array {
  return encoder.encode(str);
}

function encodeLatin1(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xFF;
  }
  return bytes;
}

/**
 * Encode a 28-bit syncsafe integer (ID3v2 header size field).
 * Each byte uses only 7 bits — the high bit is always 0.
 */
function syncsafeEncode(size: number): Uint8Array {
  return new Uint8Array([
    (size >> 21) & 0x7F,
    (size >> 14) & 0x7F,
    (size >> 7) & 0x7F,
    size & 0x7F,
  ]);
}

// ============================================================================
// FRAME BUILDERS
// ============================================================================

/**
 * Build a text information frame (T*** except TXXX).
 * Format: FrameID(4) + Size(4) + Flags(2) + Encoding(1) + Text
 */
function buildTextFrame(frameId: string, text: string): Uint8Array {
  const textBytes = encodeUtf8(text);
  const dataSize = 1 + textBytes.length; // encoding byte + text

  const frame = new Uint8Array(10 + dataSize);
  const view = new DataView(frame.buffer);

  // Frame ID (4 ASCII chars)
  for (let i = 0; i < 4; i++) {
    frame[i] = frameId.charCodeAt(i);
  }

  // Frame size (big-endian u32, NOT syncsafe in ID3v2.3)
  view.setUint32(4, dataSize);

  // Flags: 0x0000
  frame[8] = 0x00;
  frame[9] = 0x00;

  // Text encoding: 0x03 = UTF-8
  frame[10] = 0x03;

  // Text content
  frame.set(textBytes, 11);

  return frame;
}

/**
 * Build a COMM (Comment) frame.
 * Format: Encoding(1) + Language(3) + ShortDesc + NUL + Text
 */
function buildCommentFrame(text: string, language = 'eng'): Uint8Array {
  const lang = encodeLatin1(language.slice(0, 3).padEnd(3, ' '));
  const textBytes = encodeUtf8(text);
  // encoding(1) + language(3) + short description NUL(1) + text
  const dataSize = 1 + 3 + 1 + textBytes.length;

  const frame = new Uint8Array(10 + dataSize);
  const view = new DataView(frame.buffer);

  // Frame ID: "COMM"
  frame[0] = 0x43;
  frame[1] = 0x4F;
  frame[2] = 0x4D;
  frame[3] = 0x4D;

  view.setUint32(4, dataSize);
  frame[8] = 0x00;
  frame[9] = 0x00;

  let offset = 10;
  frame[offset++] = 0x03; // UTF-8 encoding
  frame.set(lang, offset);
  offset += 3;
  frame[offset++] = 0x00; // empty short description (NUL terminated)
  frame.set(textBytes, offset);

  return frame;
}

/**
 * Build an APIC (Attached Picture) frame for cover art.
 * Format: Encoding(1) + MimeType + NUL + PictureType(1) + Description + NUL + ImageData
 */
function buildApicFrame(mimeType: string, imageData: Uint8Array): Uint8Array {
  const mimeBytes = encodeLatin1(mimeType);
  // encoding(1) + mime(n) + NUL(1) + pictureType(1) + description NUL(1) + imageData
  const dataSize = 1 + mimeBytes.length + 1 + 1 + 1 + imageData.length;

  const frame = new Uint8Array(10 + dataSize);
  const view = new DataView(frame.buffer);

  // Frame ID: "APIC"
  frame[0] = 0x41;
  frame[1] = 0x50;
  frame[2] = 0x49;
  frame[3] = 0x43;

  view.setUint32(4, dataSize);
  frame[8] = 0x00;
  frame[9] = 0x00;

  let offset = 10;
  frame[offset++] = 0x00; // ISO-8859-1 encoding (simplest for APIC)
  frame.set(mimeBytes, offset);
  offset += mimeBytes.length;
  frame[offset++] = 0x00; // NUL terminator for mime
  frame[offset++] = 0x03; // Picture type: 0x03 = Cover (front)
  frame[offset++] = 0x00; // Empty description (NUL terminated)
  frame.set(imageData, offset);

  return frame;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Build a complete ID3v2.3 tag from the given options.
 * Returns a Uint8Array that should be prepended to raw MP3 data.
 */
export function buildId3v2Tag(options: Id3TagOptions): Uint8Array {
  const frames: Uint8Array[] = [];

  // Required
  frames.push(buildTextFrame('TIT2', options.title));

  // Optional text frames
  if (options.artist) {
    frames.push(buildTextFrame('TPE1', options.artist));
  }
  if (options.album) {
    frames.push(buildTextFrame('TALB', options.album));
  }
  if (options.trackNumber !== undefined) {
    frames.push(buildTextFrame('TRCK', String(options.trackNumber)));
  }
  if (options.year) {
    frames.push(buildTextFrame('TYER', options.year));
  }
  if (options.copyright) {
    frames.push(buildTextFrame('TCOP', options.copyright));
  }
  if (options.genre) {
    frames.push(buildTextFrame('TCON', options.genre));
  }

  // Comment
  if (options.comment) {
    frames.push(buildCommentFrame(options.comment.text, options.comment.language));
  }

  // Cover art
  if (options.coverImage) {
    frames.push(buildApicFrame(options.coverImage.mimeType, options.coverImage.data));
  }

  // Calculate total frame payload size
  const totalFrameSize = frames.reduce((sum, f) => sum + f.length, 0);

  // ID3v2.3 header: "ID3" + Version(2.3) + Flags(0) + Size(syncsafe 4 bytes)
  const header = new Uint8Array(10);
  header[0] = 0x49;
  header[1] = 0x44;
  header[2] = 0x33; // "ID3"
  header[3] = 0x03;
  header[4] = 0x00; // Version 2.3.0
  header[5] = 0x00; // Flags: none
  header.set(syncsafeEncode(totalFrameSize), 6);

  // Assemble: header + all frames
  const tag = new Uint8Array(10 + totalFrameSize);
  tag.set(header, 0);

  let offset = 10;
  for (const frame of frames) {
    tag.set(frame, offset);
    offset += frame.length;
  }

  return tag;
}

/**
 * Prepend an ID3v2.3 tag to existing MP3 audio data.
 * If the MP3 already starts with an ID3 tag, it will have two tags
 * (most players use the first one found).
 */
export function prependId3Tag(mp3Data: Uint8Array, options: Id3TagOptions): Uint8Array {
  const tag = buildId3v2Tag(options);
  const result = new Uint8Array(tag.length + mp3Data.length);
  result.set(tag, 0);
  result.set(mp3Data, tag.length);
  return result;
}
