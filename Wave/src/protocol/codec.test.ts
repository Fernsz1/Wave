import { describe, expect, it } from 'vitest';
import golden from '@protocol/fixtures/golden.json';
import { decode, decodeEnvelope, encode, encodeEnvelope, PROTOCOL_VERSION } from './codec';

describe('codec golden fixtures (cross-language contract)', () => {
  for (const c of golden.cases) {
    it(`encodes ${c.name}`, () => {
      expect(encode(c.type, c.object as any)).toEqual(c.tokenArray);
    });
    it(`decodes ${c.name}`, () => {
      expect(decode(c.type, c.tokenArray as any)).toEqual(c.object);
    });
  }
});

describe('envelope', () => {
  it('round-trips with a raw payload passthrough', () => {
    const env = {
      version: PROTOCOL_VERSION,
      msgId: 'abc',
      type: 'StudentProgress',
      direction: 'up',
      subject: 'science',
      section: 'Grade 4 - Section Newton',
      createdAt: '2026-06-07T00:00:00Z',
      chunkIndex: 0,
      chunkTotal: 1,
      payload: [1, 2, 3],
    };
    expect(decodeEnvelope(encodeEnvelope(env))).toEqual(env);
  });
});
