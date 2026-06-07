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
import { StudentUser, TeacherUser } from '../types';
import { RepoBootstrap, WaveRepository } from './repository';

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

  async enrollStudent(student: StudentUser): Promise<void> {
    const roster = loadRoster();
    if (!roster.some((s) => s.lrn === student.lrn)) {
      localStorage.setItem(ROSTER_KEY, JSON.stringify([...roster, student]));
    }
  }

  subscribeLive(): void {}
  unsubscribeLive(): void {}
}
