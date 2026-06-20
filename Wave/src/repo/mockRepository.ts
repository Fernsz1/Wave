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
import { GeneratedRemediation, GenerateRemediationReq, LoginResult, RepoBootstrap, WaveRepository } from './repository';

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
  password: 'password123',
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

  async login(role: 'student' | 'teacher', principalId: string, passwordOrPin: string): Promise<LoginResult> {
    if (role === 'student') {
      const found = loadRoster().find((s) => s.lrn === principalId);
      if (!found) return { ok: false, error: 'Student LRN is not enrolled on this platform. Please contact your teacher to enroll your account.' };
      if (found.pin !== passwordOrPin) return { ok: false, error: 'Incorrect PIN. Please try again.' };
      return { ok: true, user: found };
    }
    const found = loadTeachers().find((t) => t.teacherId === principalId);
    if (!found) return { ok: false, error: 'Teacher ID not recognized. Please contact your administrator.' };
    const expectedPassword = found.password || 'password123';
    if (expectedPassword !== passwordOrPin) return { ok: false, error: 'Incorrect password for this Teacher ID. Please try again.' };
    return { ok: true, user: found };
  }
  async flushPendingWrites(): Promise<void> {}
  async saveQuizAttempt(): Promise<void> {}
  async saveSummativeResult(): Promise<void> {}
  async publishRemediation(): Promise<void> {}

  async fetchRemediation(): Promise<TeacherRemediationMaterial[]> { return []; }

  async generateRemediation(req: GenerateRemediationReq): Promise<GeneratedRemediation> {
    // Resolve one or more catalog topics (multi-topic supported).
    const topicIds = req.topicIds ?? (req.topicId ? [req.topicId] : []);
    const topics = topicIds.map(findTopic).filter((t): t is Topic => Boolean(t));

    // Build structured lesson modules (mirror of the remedial "Interactive Modules").
    const sections: { title: string; body: string }[] = [];
    if (req.prompt && req.prompt.trim()) {
      sections.push({ title: 'Overview', body: `Lesson generated from teacher prompt: "${req.prompt.trim()}"` });
    }
    for (const t of topics) {
      sections.push({ title: t.name, body: t.content.introduction });
      for (const s of t.content.sections) sections.push({ title: s.title, body: s.body });
    }
    if (sections.length === 0) {
      sections.push({ title: 'Introduction', body: 'Draft lesson content. Edit the modules to finalize.' });
    }

    const title = topics[0]?.name
      ? `${topics[0].name}${topics.length > 1 ? ` (+${topics.length - 1} more)` : ''}`
      : (req.prompt?.trim().slice(0, 60) || 'Generated Lesson');
    const content = sections.map((s) => `## ${s.title}\n\n${s.body}`).join('\n\n');
    // Still return a quiz for the TeacherHome remedial flow; the lesson-only
    // wizard ignores it.
    const createdQuiz: QuizQuestion[] = topics[0]?.quiz.slice(0, 3) ?? [];

    return {
      title,
      content,
      teacherNotes: 'Review the generated modules and adjust as needed.',
      createdQuiz,
      lessonNumber: 1,
      learningGap: '',
      teachersNotes: [],
      sections,
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
