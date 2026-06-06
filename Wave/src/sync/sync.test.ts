import { describe, expect, it } from 'vitest';
import { fragment, Reassembler } from './chunk';
import { InMemoryTransport, matches } from './transport';
import { Outbox, MemoryStore } from './outbox';
import { buildEnvelope, parseEnvelope } from './envelope';

describe('chunk fragment/reassemble', () => {
  const big = JSON.stringify(Array.from({ length: 500 }, (_, i) => `item-${i}`));

  it('fragments and reassembles a large payload', () => {
    const chunks = fragment('m1', big, 64);
    expect(chunks.length).toBeGreaterThan(1);
    const r = new Reassembler();
    let out: string | null = null;
    for (const c of chunks) out = r.add(c) ?? out;
    expect(out).toBe(big);
  });

  it('tolerates out-of-order and duplicate chunks', () => {
    const chunks = fragment('m2', big, 64);
    const shuffled = [chunks[2], chunks[0], chunks[2], ...chunks.slice(1)];
    const r = new Reassembler();
    let out: string | null = null;
    for (const c of shuffled) out = r.add(c) ?? out;
    expect(out).toBe(big);
  });

  it('keeps a single frame intact', () => {
    expect(fragment('m3', 'hi', 200)).toEqual([{ msgId: 'm3', index: 0, total: 1, data: 'hi' }]);
  });
});

describe('topic matching', () => {
  it('matches + and # wildcards', () => {
    expect(matches('wave/+/Rankings', 'wave/grade-6/Rankings')).toBe(true);
    expect(matches('wave/grade-6/#', 'wave/grade-6/StudentProgress')).toBe(true);
    expect(matches('wave/+/Rankings', 'wave/grade-6/StudentProgress')).toBe(false);
  });
});

describe('InMemoryTransport retained delivery', () => {
  it('delivers a retained message to a late subscriber', () => {
    const t = new InMemoryTransport();
    t.publish('wave/x/Rankings', [1, 2, 3]);
    const got: any[] = [];
    t.subscribe('wave/+/Rankings', (_topic, tokens) => got.push(tokens));
    expect(got).toEqual([[1, 2, 3]]);
  });

  it('stops delivering after unsubscribeAll (re-subscription replaces handlers)', () => {
    const t = new InMemoryTransport();
    const a: any[] = [];
    t.subscribe('wave/grade-6/#', (_topic, tokens) => a.push(tokens));
    t.unsubscribeAll();
    const b: any[] = [];
    t.subscribe('wave/grade-4/#', (_topic, tokens) => b.push(tokens));
    t.publish('wave/grade-6/Rankings', [1]); // old section — should be ignored
    t.publish('wave/grade-4/Rankings', [2]); // new section — should arrive
    expect(a).toEqual([]);
    expect(b).toEqual([[2]]);
  });
});

describe('Outbox offline buffering', () => {
  it('queues on failure and flushes on success', () => {
    const ob = new Outbox(new MemoryStore());
    let online = false;
    const send = () => {
      if (!online) throw new Error('offline');
    };
    ob.enqueue('t', [1]);
    expect(ob.flush(send)).toBe(0);
    expect(ob.pending).toBe(1);
    online = true;
    expect(ob.flush(send)).toBe(1);
    expect(ob.pending).toBe(0);
  });

  it('flushAsync keeps items whose async send rejects, drains on success', async () => {
    const ob = new Outbox(new MemoryStore());
    let online = false;
    const send = async () => {
      if (!online) throw new Error('offline');
    };
    ob.enqueue('t', [1]);
    ob.enqueue('t', [2]);
    expect(await ob.flushAsync(send)).toBe(0);
    expect(ob.pending).toBe(2);
    online = true;
    expect(await ob.flushAsync(send)).toBe(2);
    expect(ob.pending).toBe(0);
  });
});

describe('envelope build/parse', () => {
  it('parses back the meta and payload object', () => {
    const tokens = buildEnvelope(
      'StudentSignup',
      { lrn: '101234567900', name: 'Jacob', gradeLevel: 'G6', section: 'G6', pin: '123456' },
      { direction: 'up', subject: 'science', section: 'G6' },
    );
    const { meta, payload } = parseEnvelope<any>(tokens);
    expect(meta.type).toBe('StudentSignup');
    expect(meta.direction).toBe('up');
    expect(payload.lrn).toBe('101234567900');
  });
});
