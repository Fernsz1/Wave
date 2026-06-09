import { describe, expect, it } from 'vitest';
import { deflateToB64, inflateFromB64 } from './compress';
import { buildEnvelope, parseEnvelope, ENC_DEFLATE } from './envelope';
import interop from '@protocol/fixtures/compress.json';

describe('compress — DEFLATE payload codec', () => {
  it('round-trips an arbitrary UTF-8 string', () => {
    const s = JSON.stringify({ msg: 'opposing muscles 💪', items: Array.from({ length: 50 }, (_, i) => `q-${i}`) });
    expect(inflateFromB64(deflateToB64(s))).toBe(s);
  });

  it('matches the cross-language interop fixture (same bytes as Python zlib)', () => {
    expect(inflateFromB64(interop.b64)).toBe(interop.raw);
    expect(deflateToB64(interop.raw)).toBe(interop.b64);
  });

  it('shrinks a large, repetitive payload', () => {
    const s = 'Skeletal muscles work in opposing pairs. '.repeat(40);
    const b64 = deflateToB64(s);
    expect(b64.length).toBeLessThan(s.length);
  });

  it('compresses a large remediation envelope (enc=1) and decodes back identically', () => {
    const material = {
      id: 'REM-9', originalTopicId: 'L1-T2', title: 'Remedial: Muscles',
      content: '## Rubber band analogy. '.repeat(60),
      teacherNotes: 'Read through then answer. '.repeat(10),
      createdQuiz: Array.from({ length: 4 }, (_, i) => ({
        id: `Q${i}`, question: `Why do muscles pull #${i}?`,
        options: ['a', 'b', 'c', 'd'], correctAnswerIndex: 1, explanation: 'They can only pull.',
      })),
      publishDate: '2026-06-09', targetSection: 'Grade 4 - Section Newton', chunks: [], isPublished: true,
    };
    const env = buildEnvelope('TeacherRemediationMaterial', material, { direction: 'down', subject: 'science', section: 'Grade 4 - Section Newton' });
    const { meta, payload } = parseEnvelope<any>(env);
    expect(meta.enc).toBe(ENC_DEFLATE);
    expect(payload.id).toBe('REM-9');
    expect(payload.createdQuiz).toHaveLength(4);
    expect(payload.content).toBe(material.content);
  });

  it('leaves a tiny payload uncompressed (enc absent)', () => {
    const env = buildEnvelope('StudentSignup', { lrn: '1', name: 'A', gradeLevel: 'G', section: 'G', pin: '1' }, { direction: 'up' });
    const { meta } = parseEnvelope<any>(env);
    expect(meta.enc).toBeUndefined();
  });
});
