import { describe, expect, it } from 'vitest';
import { HttpRepository } from './httpRepository';
import { InMemoryTransport } from '../sync/transport';
import { MemoryStore } from '../sync/outbox';
import { buildEnvelope } from '../sync/envelope';
import { topicFor } from '../sync/topics';

/**
 * Proves the TEACHER-side live path end to end at the repository boundary:
 * an MQTT "down" envelope arriving on the section topic is decoded, validated,
 * and surfaced as the RepoUpdate that App.applyRepoUpdate feeds into
 * setProgressRecords — i.e. the on-screen records re-render without a refresh.
 */
const G4 = 'Grade 4 - Section Newton';
const G6 = 'Grade 6 - Section Einstein';

function progress(lrn: string, section: string, topic = 'L2-T3') {
  return {
    studentLrn: lrn,
    section,
    completedTopicIds: [topic],
    quizAttempts: { [topic]: { topicId: topic, score: 2, perfectScore: 2, answers: [1, 2], completedAt: '2026-06-08' } },
    quizScores: { [topic]: { score: 2, total: 2, percent: 100, passed: true } },
    summativeScores: {},
  };
}

function teacherRepo(transport: InMemoryTransport) {
  return new HttpRepository('http://x', 'ws://x', { transport, outboxStore: new MemoryStore() });
}

describe('HttpRepository — teacher live updates', () => {
  it('converts an incoming down StudentProgress into a progress RepoUpdate', () => {
    const transport = new InMemoryTransport();
    const repo = teacherRepo(transport);
    const updates: any[] = [];
    repo.subscribeLive({ role: 'teacher', section: G4, subject: 'science', onUpdate: (u) => updates.push(u) });

    // Simulate the Django web process broadcasting a student's progress down to the section.
    const env = buildEnvelope('StudentProgress', progress('101234567892', G4), { direction: 'down', subject: 'science', section: G4 });
    transport.publish(topicFor('StudentProgress', G4), env);

    expect(updates).toHaveLength(1);
    expect(updates[0].kind).toBe('progress');
    expect(updates[0].record.studentLrn).toBe('101234567892');
    expect(updates[0].record.completedTopicIds).toContain('L2-T3');
  });

  it('ignores up-direction echoes (prevents double-handling)', () => {
    const transport = new InMemoryTransport();
    const repo = teacherRepo(transport);
    const updates: any[] = [];
    repo.subscribeLive({ role: 'teacher', section: G4, subject: 'science', onUpdate: (u) => updates.push(u) });

    const env = buildEnvelope('StudentProgress', progress('x', G4), { direction: 'up', section: G4 });
    transport.publish(topicFor('StudentProgress', G4), env);

    expect(updates).toHaveLength(0);
  });

  it('after switching sections, only the new section delivers live', () => {
    const transport = new InMemoryTransport();
    const repo = teacherRepo(transport);
    const updates: any[] = [];
    repo.subscribeLive({ role: 'teacher', section: G4, subject: 'science', onUpdate: (u) => updates.push(u) });
    repo.subscribeLive({ role: 'teacher', section: G6, subject: 'science', onUpdate: (u) => updates.push(u) }); // dropdown change

    transport.publish(topicFor('StudentProgress', G4), buildEnvelope('StudentProgress', progress('old', G4), { direction: 'down', section: G4 }));
    transport.publish(topicFor('StudentProgress', G6), buildEnvelope('StudentProgress', progress('new', G6, 'L1-T1'), { direction: 'down', section: G6 }));

    expect(updates).toHaveLength(1);
    expect(updates[0].record.studentLrn).toBe('new');
  });

  it('surfaces a remediation broadcast as a remediation RepoUpdate', () => {
    const transport = new InMemoryTransport();
    const repo = teacherRepo(transport);
    const updates: any[] = [];
    repo.subscribeLive({ role: 'student', lrn: '101234567892', section: G4, subject: 'science', onUpdate: (u) => updates.push(u) });

    const material = {
      id: 'R-1', originalTopicId: 'L1-T2', title: 'Remedial: Muscles', content: 'review', teacherNotes: 'focus',
      createdQuiz: [], publishDate: '2026-06-08', targetSection: G4, chunks: [], isPublished: true,
    };
    transport.publish(topicFor('TeacherRemediationMaterial', G4), buildEnvelope('TeacherRemediationMaterial', material, { direction: 'down', section: G4 }));

    expect(updates).toHaveLength(1);
    expect(updates[0].kind).toBe('remediation');
    expect(updates[0].material.targetSection).toBe(G4);
  });
});
