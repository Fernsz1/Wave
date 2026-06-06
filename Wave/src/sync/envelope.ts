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

export type Direction = 'up' | 'down';

export interface EnvelopeMeta {
  msgId: string;
  type: string;
  direction: Direction;
  subject?: string;
  section?: string;
  createdAt: string;
  chunkIndex: number;
  chunkTotal: number;
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
    payload: encode(type, obj),
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
    },
    payload: decode<T>(env.type, env.payload as Token[]),
  };
}
