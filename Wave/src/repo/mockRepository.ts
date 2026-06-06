/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * In-memory repository — preserves the app's original behavior with no server.
 * Reads seed data from data.ts and the localStorage roster; mutations are no-ops
 * here because App.tsx keeps the authoritative React state (optimistic updates).
 */
import {
  MOCK_LESSONS_BY_SUBJECT,
  MOCK_STUDENTS,
  INITIAL_PROGRESS_RECORDS,
  INITIAL_REMEDIATION_MATERIALS,
} from '../data';
import { StudentUser } from '../types';
import { RepoBootstrap, WaveRepository } from './repository';

const ROSTER_KEY = 'wave_enrolled_students';

function loadRoster(): StudentUser[] {
  const stored = localStorage.getItem(ROSTER_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.some((s: any) => s.gradeLevel?.includes('Grade 4') || s.gradeLevel?.includes('Grade 6'))) {
        return parsed;
      }
    } catch {
      /* fall through to seed */
    }
  }
  const initial = MOCK_STUDENTS.map((s) => ({ ...s, pin: s.pin || '123456' }));
  localStorage.setItem(ROSTER_KEY, JSON.stringify(initial));
  return initial;
}

export class MockRepository implements WaveRepository {
  readonly isLive = false;

  async bootstrap(): Promise<RepoBootstrap> {
    return {
      students: loadRoster(),
      lessonsBySubject: MOCK_LESSONS_BY_SUBJECT,
      progressRecords: structuredClone(INITIAL_PROGRESS_RECORDS),
      remediationMaterials: structuredClone(INITIAL_REMEDIATION_MATERIALS),
    };
  }

  async authenticate(): Promise<void> {}
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
