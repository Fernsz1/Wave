/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * DEFLATE payload compression for the LoRa-bound wire.
 *
 * The codec turns a message into a tokenized array; this layer compresses that
 * array's JSON with zlib-format DEFLATE so the (often verbose) remediation/quiz
 * text rides as a fraction of the bytes. `server/wave_api/compress.py` is the
 * mirror: pako (here) and Python's `zlib` both speak the self-describing zlib
 * format, so either side inflates the other's output regardless of exact bytes.
 *
 * Synchronous on purpose — `buildEnvelope`/`Transport.publish` are sync.
 */
import pako from 'pako';

function u8ToB64(u8: Uint8Array): string {
  let bin = '';
  // Chunked to avoid call-stack limits on large payloads.
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) {
    bin += String.fromCharCode(...u8.subarray(i, i + CH));
  }
  return btoa(bin);
}

function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

/** UTF-8 string -> DEFLATE -> base64 (ASCII, safe for JSON/MQTT/REST today). */
export function deflateToB64(s: string): string {
  return u8ToB64(pako.deflate(s));
}

/** base64 -> DEFLATE-inflate -> UTF-8 string. */
export function inflateFromB64(b64: string): string {
  return pako.inflate(b64ToU8(b64), { to: 'string' });
}

/** Raw DEFLATE bytes — what the LoRa radio carries directly (no base64). */
export function deflateToBytes(s: string): Uint8Array {
  return pako.deflate(s);
}

export function inflateFromBytes(bytes: Uint8Array): string {
  return pako.inflate(bytes, { to: 'string' });
}
