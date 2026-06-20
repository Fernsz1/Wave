/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * LoRa-readiness: the full Grade 7 science LessonCatalog must survive the wire
 * path — encode -> envelope -> JSON -> fragment -> (shuffled) reassemble ->
 * decode. Mirrors server/tests/test_lora_catalog_roundtrip.py.
 */
import { describe, it, expect } from 'vitest';
import scienceData from '../content/science.json';
import { encode, decode, encodeEnvelope, PROTOCOL_VERSION, Token } from '../protocol/codec';
import { decodeEnvelope } from '../protocol/codec';
import { fragment, Reassembler, Chunk } from './chunk';
import { LessonSchema } from '../schemas';
import { z } from 'zod';

const LORA_SAFE_FRAME = 180;

describe('Grade 7 catalog over LoRa framing', () => {
  it('survives fragment -> shuffled reassemble -> decode', () => {
    const payload = encode('LessonCatalog', { subject: 'science', lessons: scienceData.lessons });
    const env = encodeEnvelope({
      version: PROTOCOL_VERSION,
      msgId: 'cat-0001',
      type: 'LessonCatalog',
      direction: 'down',
      subject: 'science',
      section: null,
      createdAt: '2026-06-20T00:00:00Z',
      chunkIndex: 0,
      chunkTotal: 1,
      payload,
    });
    const serialized = JSON.stringify(env);

    const chunks = fragment('cat-0001', serialized, LORA_SAFE_FRAME);
    expect(chunks.length).toBeGreaterThan(1);

    // Out-of-order + a duplicate frame must still reassemble.
    const shuffled: Chunk[] = [...chunks, chunks[0]].sort(() => Math.random() - 0.5);
    const reasm = new Reassembler();
    let result: string | null = null;
    for (const c of shuffled) {
      const out = reasm.add(c);
      if (out !== null) result = out;
    }
    expect(result).toBe(serialized);

    const decodedEnv = decodeEnvelope(JSON.parse(result as string));
    const catalog = decode<{ subject: string; lessons: unknown[] }>('LessonCatalog', decodedEnv.payload as Token[]);
    expect(catalog.lessons).toHaveLength(4);
    expect(z.array(LessonSchema).safeParse(catalog.lessons).success).toBe(true);
  });
});
