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
import { FailedItem, Lesson, QuizQuestion, StudentProgress, StudentUser, TeacherUser, TeacherRemediationMaterial } from '../types';

export interface GenerateRemediationReq {
  subject: string;
  topicId?: string; // legacy single-topic (still accepted)
  topicIds?: string[]; // one or more catalog topics to base the lesson on
  studentName?: string;
  gradeLevel?: string;
  section?: string;
  prompt?: string; // free-text teacher instruction (lesson generator)
  failedItems?: string[];
}

export interface GeneratedRemediation {
  title: string;
  content: string;
  teacherNotes: string;
  createdQuiz: QuizQuestion[];
  lessonNumber?: number;
  learningGap?: string;
  teachersNotes?: string[];
  // Structured lesson body blocks (mirror of the remedial lesson "Interactive
  // Modules"). Maps from the AI `concepts` (header_title/explanation).
  sections?: { title: string; body: string }[];
}

export interface RepoBootstrap {
  students: StudentUser[];
  teachers: TeacherUser[];
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
  failedItems?: FailedItem[];
}

export interface SubscribeOpts {
  role: 'student' | 'teacher';
  lrn?: string;
  section?: string;
  subject?: string;
  onUpdate: (u: RepoUpdate) => void;
}

export type LoginResult = { ok: true; user: StudentUser | TeacherUser } | { ok: false; error: string };

export interface WaveRepository {
  /** Cold-start data load. */
  bootstrap(): Promise<RepoBootstrap>;
  /**
   * Validate credentials and, for HttpRepository, establish a session token in
   * the same round-trip — the server is the sole source of truth for the login
   * decision (no plaintext PIN/password is ever fetched via bootstrap/roster).
   */
  login(role: 'student' | 'teacher', principalId: string, passwordOrPin: string): Promise<LoginResult>;
  /** Flush any writes queued while offline. Call after login resolves. No-op for Mock. */
  flushPendingWrites(): Promise<void>;
  saveQuizAttempt(w: QuizAttemptWrite): Promise<void>;
  saveSummativeResult(w: SummativeWrite): Promise<void>;
  publishRemediation(material: TeacherRemediationMaterial, opts: { subject: string; section: string }): Promise<void>;
  generateRemediation(req: GenerateRemediationReq): Promise<GeneratedRemediation>;
  fetchRemediation(section?: string): Promise<TeacherRemediationMaterial[]>;
  enrollStudent(student: StudentUser): Promise<void>;
  /** (Re)subscribe to live "down" updates; idempotent — replaces any prior subscription. No-op for Mock. */
  subscribeLive(opts: SubscribeOpts): void;
  /** Tear down the live subscription (e.g. on logout). No-op for Mock. */
  unsubscribeLive(): void;
  /** Whether this repo syncs with a live backend (controls optimistic-only flows). */
  readonly isLive: boolean;
}
