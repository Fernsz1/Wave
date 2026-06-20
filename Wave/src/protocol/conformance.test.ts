/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Conformance guards (see protocol/OWNERSHIP.md): the validation layer must
 * cover exactly the manifest's message types, decodeEnvelope must reject an
 * incompatible protocolVersion, and slug() must match the shared fixture that
 * the Python suite also asserts — so app and server address identical topics.
 */
import { describe, it, expect } from 'vitest';
import manifest from '@protocol/wire_manifest.json';
import slugGolden from '@protocol/fixtures/slug_golden.json';
import { SCHEMA_BY_TYPE } from '../schemas';
import { decodeEnvelope, encodeEnvelope, PROTOCOL_VERSION } from './codec';
import { slug } from '../sync/topics';

describe('wire conformance', () => {
  it('SCHEMA_BY_TYPE covers exactly the manifest message types', () => {
    expect(Object.keys(SCHEMA_BY_TYPE).sort()).toEqual(
      [...manifest.enums.type].sort(),
    );
  });

  it('TeacherRemediationMaterial schema carries subject (round-trip field)', () => {
    const parsed = SCHEMA_BY_TYPE.TeacherRemediationMaterial.safeParse({
      id: 'REM-1',
      originalTopicId: 'L1-T1',
      title: 't',
      content: 'c',
      teacherNotes: 'n',
      createdQuiz: [],
      publishDate: '2026-06-18',
      targetSection: 'Grade 7 - Section Rizal',
      chunks: [],
      isPublished: true,
      subject: 'science',
    });
    expect(parsed.success).toBe(true);
  });

  it('decodeEnvelope rejects an incompatible protocolVersion', () => {
    const env = encodeEnvelope({
      version: PROTOCOL_VERSION + 1,
      msgId: 'x',
      type: 'StudentProgress',
      direction: 'up',
      subject: null,
      section: null,
      createdAt: '2026-06-07T00:00:00Z',
      chunkIndex: 0,
      chunkTotal: 1,
      payload: [],
    });
    expect(() => decodeEnvelope(env)).toThrow(/protocolVersion/);
  });

  it('slug matches the shared golden fixture (parity with server)', () => {
    for (const c of slugGolden.cases) {
      expect(slug(c.section)).toBe(c.slug);
    }
  });
});
