/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Fragment a serialized payload into LoRa-frame-sized chunks and reassemble them.
 * Pure + transport-agnostic so it can sit under MqttTransport now and LoRaTransport
 * later. Reassembly dedupes by index and tolerates out-of-order arrival.
 */
export interface Chunk {
  msgId: string;
  index: number;
  total: number;
  data: string; // a slice of the JSON-serialized token array
}

const DEFAULT_FRAME = 200; // bytes-ish; LoRa frames are small. Configurable per radio.

export function fragment(msgId: string, serialized: string, frameSize = DEFAULT_FRAME): Chunk[] {
  if (serialized.length <= frameSize) {
    return [{ msgId, index: 0, total: 1, data: serialized }];
  }
  const parts: string[] = [];
  for (let i = 0; i < serialized.length; i += frameSize) {
    parts.push(serialized.slice(i, i + frameSize));
  }
  return parts.map((data, index) => ({ msgId, index, total: parts.length, data }));
}

/** Accumulates chunks per msgId; returns the reassembled string once complete. */
export class Reassembler {
  private buffers = new Map<string, Map<number, string>>();

  add(chunk: Chunk): string | null {
    let buf = this.buffers.get(chunk.msgId);
    if (!buf) {
      buf = new Map();
      this.buffers.set(chunk.msgId, buf);
    }
    buf.set(chunk.index, chunk.data); // dedupe: same index overwrites
    if (buf.size < chunk.total) return null;

    let out = '';
    for (let i = 0; i < chunk.total; i++) {
      const piece = buf.get(i);
      if (piece === undefined) return null; // missing a piece still
      out += piece;
    }
    this.buffers.delete(chunk.msgId);
    return out;
  }
}
