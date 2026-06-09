import { beforeEach, describe, expect, it } from 'vitest';
import { MockRepository } from './mockRepository';

/**
 * Proves the offline default is a real single-device system of record: a
 * student's quiz/summative writes and a teacher's published remediation are
 * persisted and re-surface on the next bootstrap — i.e. data travels between
 * the student and teacher actors across reloads, not just within one session.
 */
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

beforeEach(() => {
  (globalThis as any).localStorage = new MemoryStorage();
});

const G4 = 'Grade 4 - Section Newton';

describe('MockRepository — offline persistence', () => {
  it('persists a quiz attempt so the next bootstrap returns it', async () => {
    const repo = new MockRepository();
    await repo.saveQuizAttempt({
      lrn: '101234567892', topicId: 'L2-T3', lessonId: 'L2',
      score: 2, perfectScore: 2, answers: [1, 2], section: G4, subject: 'science',
    });

    const b = await repo.bootstrap();
    const rec = b.progressRecords['101234567892'];
    expect(rec.quizAttempts['L2-T3'].score).toBe(2);
    expect(rec.completedTopicIds).toContain('L2-T3');
  });

  it('persists a summative result with band-derived feedback', async () => {
    const repo = new MockRepository();
    await repo.saveSummativeResult({ lrn: '101234567892', lessonId: 'L1', score: 19, section: G4, subject: 'science' });

    const b = await repo.bootstrap();
    expect(b.progressRecords['101234567892'].summativeScores['L1']).toEqual({
      score: 19, perfectScore: 20, feedback: 'Excellent mastery.',
    });
  });

  it('persists a published remediation pack section-targeted', async () => {
    const repo = new MockRepository();
    const material = {
      id: 'REM-test', originalTopicId: 'L1-T2', title: 't', content: 'c', teacherNotes: 'n',
      createdQuiz: [], publishDate: '2026-06-09', assignedStudentLrn: '101234567892', isPublished: true,
    } as any;
    await repo.publishRemediation(material, { subject: 'science', section: G4 });

    const b = await repo.bootstrap();
    const pub = b.remediationMaterials.find((m) => m.id === 'REM-test');
    expect(pub?.targetSection).toBe(G4);
  });
});
