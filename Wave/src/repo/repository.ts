/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Data-access seam. The app talks only to this interface; `MockRepository`
 * preserves today's in-memory behavior (no server needed) and `HttpRepository`
 * syncs with Django over REST + MQTT. Returns the app's INTERNAL types so the UI
 * components are unchanged.
 */
import { Lesson, StudentProgress, StudentUser, TeacherRemediationMaterial } from '../types';

export interface RepoBootstrap {
  students: StudentUser[];
  lessonsBySubject: Record<string, Lesson[]>;
  progressRecords: Record<string, StudentProgress>;
  remediationMaterials: TeacherRemediationMaterial[];
}

export interface Standing {
  rank: number;
  studentLrn: string;
  name: string;
  score: number;
  perfect: number;
  percent: number;
}

export type RepoUpdate =
  | { kind: 'progress'; record: StudentProgress }
  | { kind: 'rankings'; section: string; subject: string; standings: Standing[] }
  | { kind: 'remediation'; material: TeacherRemediationMaterial };

export interface QuizAttemptWrite {
  lrn: string;
  topicId: string;
  lessonId: string;
  score: number;
  perfectScore: number;
  answers: number[];
  section: string;
  subject: string;
}

export interface SummativeWrite {
  lrn: string;
  lessonId: string;
  score: number;
  section: string;
  subject: string;
}

export interface SubscribeOpts {
  role: 'student' | 'teacher';
  lrn?: string;
  section?: string;
  subject?: string;
  onUpdate: (u: RepoUpdate) => void;
}

export interface WaveRepository {
  /** Cold-start data load. */
  bootstrap(): Promise<RepoBootstrap>;
  /** Establish a session/token (no-op for Mock). */
  authenticate(role: 'student' | 'teacher', principalId: string, name?: string): Promise<void>;
  saveQuizAttempt(w: QuizAttemptWrite): Promise<void>;
  saveSummativeResult(w: SummativeWrite): Promise<void>;
  publishRemediation(material: TeacherRemediationMaterial, opts: { subject: string; section: string }): Promise<void>;
  enrollStudent(student: StudentUser): Promise<void>;
  /** (Re)subscribe to live "down" updates; idempotent — replaces any prior subscription. No-op for Mock. */
  subscribeLive(opts: SubscribeOpts): void;
  /** Tear down the live subscription (e.g. on logout). No-op for Mock. */
  unsubscribeLive(): void;
  /** Whether this repo syncs with a live backend (controls optimistic-only flows). */
  readonly isLive: boolean;
}
