/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Build/parse the tokenized sync envelope (mirrors server/wave_api/mqtt.py). */
import {
  PROTOCOL_VERSION,
  Token,
  encode,
  encodeEnvelope,
  decode,
  decodeEnvelope,
} from '../protocol/codec';
import { deflateToB64, inflateFromB64 } from './compress';

export type Direction = 'up' | 'down';

/** Payload codec flag carried in the envelope: absent/0 = raw tokens, 1 = DEFLATE+base64. */
export const ENC_DEFLATE = 1;

export interface EnvelopeMeta {
  msgId: string;
  type: string;
  direction: Direction;
  subject?: string;
  section?: string;
  createdAt: string;
  chunkIndex: number;
  chunkTotal: number;
  enc?: number;
}

/**
 * Pack an encoded payload token array, compressing it when that actually shrinks
 * the bytes (so tiny messages never inflate). Returns the envelope `enc` flag and
 * the `payload` field — `[base64]` when compressed, the raw tokens otherwise.
 */
export function packPayload(payloadTokens: Token[]): { enc?: number; payload: Token } {
  const json = JSON.stringify(payloadTokens);
  const b64 = deflateToB64(json);
  if (b64.length < json.length) return { enc: ENC_DEFLATE, payload: [b64] };
  return { payload: payloadTokens };
}

/** Reverse of packPayload: returns the raw payload token array. */
export function unpackPayload(enc: number | undefined, payload: Token): Token[] {
  if (enc === ENC_DEFLATE) {
    const b64 = (payload as Token[])[0] as string;
    return JSON.parse(inflateFromB64(b64));
  }
  return payload as Token[];
}

function uuid(): string {
  // crypto.randomUUID is available in browsers and Node 18+.
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

/** Encode {meta + payload object} into the tokenized envelope array. */
export function buildEnvelope(
  type: string,
  obj: Record<string, any>,
  opts: { direction: Direction; subject?: string; section?: string },
): Token[] {
  const { enc, payload } = packPayload(encode(type, obj));
  return encodeEnvelope({
    version: PROTOCOL_VERSION,
    msgId: uuid(),
    type,
    direction: opts.direction,
    subject: opts.subject ?? null,
    section: opts.section ?? null,
    createdAt: new Date().toISOString(),
    chunkIndex: 0,
    chunkTotal: 1,
    enc: enc ?? null,
    payload,
  });
}

/** Parse a tokenized envelope; returns meta + the decoded payload object. */
export function parseEnvelope<T = Record<string, any>>(
  tokens: Token[],
): { meta: EnvelopeMeta; payload: T } {
  const env = decodeEnvelope(tokens);
  return {
    meta: {
      msgId: env.msgId,
      type: env.type,
      direction: env.direction,
      subject: env.subject,
      section: env.section,
      createdAt: env.createdAt,
      chunkIndex: env.chunkIndex,
      chunkTotal: env.chunkTotal,
      enc: env.enc ?? undefined,
    },
    payload: decode<T>(env.type, unpackPayload(env.enc, env.payload)),
  };
}
