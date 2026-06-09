import { describe, expect, it } from 'vitest';
import { LoRaTransport, LoopbackFrameLink } from './transport';
import { buildEnvelope, parseEnvelope } from './envelope';
import { Token } from '../protocol/codec';

/**
 * Proves the LoRa byte path end to end: an envelope (already carrying a
 * DEFLATE-compressed payload) is serialized, fragmented into <=200-byte BYTE
 * frames on the radio, reassembled on the far side, and decoded back to the
 * original object — the pipeline the real radio driver will reuse.
 */
describe('LoRaTransport — byte frames over a shared radio link', () => {
  it('fragments a large remediation envelope into byte frames and reassembles it', () => {
    const link = new LoopbackFrameLink();
    const frames: Uint8Array[] = [];
    const origSend = link.send.bind(link);
    link.send = (f: Uint8Array) => { frames.push(f); origSend(f); };

    const sender = new LoRaTransport(link, 200);
    const receiver = new LoRaTransport(link, 200);

    const material = {
      id: 'REM-7', originalTopicId: 'L1-T2', title: 'Remedial: Muscles',
      content: 'Muscles can only pull, so they work in opposing pairs. '.repeat(50),
      teacherNotes: 'Read then answer.', createdQuiz: [], publishDate: '2026-06-09',
      targetSection: 'Grade 4 - Section Newton', chunks: [], isPublished: true,
    };
    const env = buildEnvelope('TeacherRemediationMaterial', material, { direction: 'down', subject: 'science', section: 'Grade 4 - Section Newton' });
    const topic = 'wave/grade-4-section-newton/TeacherRemediationMaterial';

    const received: { topic: string; tokens: Token[] }[] = [];
    receiver.subscribe('wave/grade-4-section-newton/#', (t, tokens) => received.push({ topic: t, tokens }));

    sender.publish(topic, env);

    // Multiple raw byte frames went over the radio.
    expect(frames.length).toBeGreaterThan(1);
    expect(frames[0]).toBeInstanceOf(Uint8Array);

    // Reassembled + decoded back to the original object.
    expect(received).toHaveLength(1);
    const { meta, payload } = parseEnvelope<any>(received[0].tokens);
    expect(meta.type).toBe('TeacherRemediationMaterial');
    expect(payload.id).toBe('REM-7');
    expect(payload.content).toBe(material.content);
  });

  it('routes by topic filter (a non-matching subscriber gets nothing)', () => {
    const link = new LoopbackFrameLink();
    const sender = new LoRaTransport(link);
    const other = new LoRaTransport(link);
    const got: Token[][] = [];
    other.subscribe('wave/grade-6-section-einstein/#', (_t, tokens) => got.push(tokens));

    const env = buildEnvelope('Rankings', { section: 'Grade 4 - Section Newton', subject: 'science', standings: [] }, { direction: 'down', section: 'Grade 4 - Section Newton' });
    sender.publish('wave/grade-4-section-newton/Rankings', env);

    expect(got).toHaveLength(0);
  });
});
