/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * In-memory repository — preserves the app's original behavior with no server.
 * Reads seed data from data.ts and the localStorage roster; mutations are no-ops
 * here because App.tsx keeps the authoritative React state (optimistic updates).
 */
import { MOCK_LESSONS_BY_SUBJECT } from '../data';
import { QuizQuestion, StudentUser, TeacherUser, Topic, TeacherRemediationMaterial } from '../types';
import { GeneratedRemediation, GenerateRemediationReq, RepoBootstrap, WaveRepository } from './repository';

function findTopic(topicId: string): Topic | undefined {
  for (const lessons of Object.values(MOCK_LESSONS_BY_SUBJECT)) {
    for (const lesson of lessons) {
      const t = lesson.topics.find(tp => tp.id === topicId);
      if (t) return t;
    }
  }
  return undefined;
}

const ROSTER_KEY = 'wave_enrolled_students';
const TEACHERS_KEY = 'wave_enrolled_teachers';

const DEMO_STUDENT: StudentUser = {
  lrn: '101234567891',
  name: 'Maria Santos',
  gradeLevel: 'Grade 6',
  section: 'Grade 6 - Section Einstein',
  pin: '123456',
};

const DEMO_TEACHER: TeacherUser = {
  teacherId: 'T-2026-001',
  name: 'Mrs. Elena Santos',
  department: 'General Academics',
};

function loadRoster(): StudentUser[] {
  const stored = localStorage.getItem(ROSTER_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fall through */ }
  }
  const seed = [DEMO_STUDENT];
  localStorage.setItem(ROSTER_KEY, JSON.stringify(seed));
  return seed;
}

function loadTeachers(): TeacherUser[] {
  const stored = localStorage.getItem(TEACHERS_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fall through */ }
  }
  const seed = [DEMO_TEACHER];
  localStorage.setItem(TEACHERS_KEY, JSON.stringify(seed));
  return seed;
}

export class MockRepository implements WaveRepository {
  readonly isLive = false;

  async bootstrap(): Promise<RepoBootstrap> {
    return {
      students: loadRoster(),
      teachers: loadTeachers(),
      lessonsBySubject: MOCK_LESSONS_BY_SUBJECT,
      progressRecords: {},
      remediationMaterials: [],
    };
  }

  async authenticate(): Promise<void> {}
  async flushPendingWrites(): Promise<void> {}
  async saveQuizAttempt(): Promise<void> {}
  async saveSummativeResult(): Promise<void> {}
  async publishRemediation(): Promise<void> {}

  async fetchRemediation(): Promise<TeacherRemediationMaterial[]> { return []; }

  async generateRemediation(req: GenerateRemediationReq): Promise<GeneratedRemediation> {
    const topic = findTopic(req.topicId);
    if (!topic) return { title: 'Remedial Review', content: 'Review the topic and try again.', teacherNotes: '', createdQuiz: [] };
    const c = topic.content;
    const parts = [`## Remedial Review: ${topic.name}`, '', c.introduction];
    for (const s of c.sections) parts.push(`\n### ${s.title}\n${s.body}`);
    if (c.keyTakeaway) parts.push(`\n**Key takeaway:** ${c.keyTakeaway}`);
    const quiz: QuizQuestion[] = topic.quiz.slice(0, 3);
    return {
      title: `Remedial: ${topic.name}`,
      content: parts.filter(Boolean).join('\n'),
      teacherNotes: `Custom review on ${topic.name} for ${req.studentName}.`,
      createdQuiz: quiz,
    };
  }

  async enrollStudent(student: StudentUser): Promise<void> {
    const roster = loadRoster();
    if (!roster.some((s) => s.lrn === student.lrn)) {
      localStorage.setItem(ROSTER_KEY, JSON.stringify([...roster, student]));
    }
  }

  subscribeLive(): void {}
  unsubscribeLive(): void {}
}
