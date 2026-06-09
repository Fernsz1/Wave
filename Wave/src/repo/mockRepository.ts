/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * In-memory + localStorage repository — the offline, no-server default.
 *
 * It is the single-device system of record: bootstrap reads seed data on first
 * run and the persisted store thereafter; writes (quiz/summative/remediation)
 * are merged into localStorage exactly like the server's upserts, so a student's
 * work and a teacher's published packs survive reloads and travel between the
 * two actors — mirroring the HttpRepository's server-of-record semantics.
 */
import {
  MOCK_LESSONS_BY_SUBJECT,
  MOCK_STUDENTS,
  INITIAL_PROGRESS_RECORDS,
  INITIAL_REMEDIATION_MATERIALS,
} from '../data';
import { summativeFeedback } from '../feedback';
import { withSection } from '../section';
import { QuizQuestion, StudentProgress, StudentUser, TeacherRemediationMaterial, Topic } from '../types';
import {
  GeneratedRemediation,
  GenerateRemediationReq,
  QuizAttemptWrite,
  RepoBootstrap,
  SummativeWrite,
  WaveRepository,
} from './repository';

/** Find a topic by id across all subjects in the seed catalog. */
function findTopic(topicId: string): Topic | null {
  for (const lessons of Object.values(MOCK_LESSONS_BY_SUBJECT)) {
    for (const lesson of lessons) {
      const t = lesson.topics.find((tp) => tp.id === topicId);
      if (t) return t;
    }
  }
  return null;
}

/** Deterministic remedial content built from a topic's own catalog material. */
function buildRemedialContent(topic: Topic): string {
  const c = topic.content;
  const parts = [`## Remedial Review: ${topic.name}`, '', c.introduction];
  for (const s of c.sections) parts.push(`\n### ${s.title}\n${s.body}`);
  if (c.keyTakeaway) parts.push(`\n**Key takeaway:** ${c.keyTakeaway}`);
  return parts.filter(Boolean).join('\n');
}

const ROSTER_KEY = 'wave_enrolled_students';
const PROGRESS_KEY = 'wave_progress_records';
const REMEDIATION_KEY = 'wave_remediation_materials';

function loadRoster(): StudentUser[] {
  const stored = localStorage.getItem(ROSTER_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.some((s: any) => s.gradeLevel?.includes('Grade 4') || s.gradeLevel?.includes('Grade 6'))) {
        return parsed.map((s: StudentUser) => withSection({ ...s, pin: s.pin || '123456' }));
      }
    } catch {
      /* fall through to seed */
    }
  }
  const initial = MOCK_STUDENTS.map((s) => withSection({ ...s, pin: s.pin || '123456' }));
  localStorage.setItem(ROSTER_KEY, JSON.stringify(initial));
  return initial;
}

function loadProgress(): Record<string, StudentProgress> {
  const stored = localStorage.getItem(PROGRESS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      /* fall through to seed */
    }
  }
  const seed = structuredClone(INITIAL_PROGRESS_RECORDS);
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(seed));
  return seed;
}

function saveProgress(records: Record<string, StudentProgress>): void {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(records));
}

function loadRemediation(): TeacherRemediationMaterial[] {
  const stored = localStorage.getItem(REMEDIATION_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      /* fall through to seed */
    }
  }
  const seed = structuredClone(INITIAL_REMEDIATION_MATERIALS);
  localStorage.setItem(REMEDIATION_KEY, JSON.stringify(seed));
  return seed;
}

function emptyRecord(lrn: string): StudentProgress {
  return { studentLrn: lrn, completedTopicIds: [], quizAttempts: {}, summativeScores: {} };
}

export class MockRepository implements WaveRepository {
  readonly isLive = false;

  async bootstrap(): Promise<RepoBootstrap> {
    return {
      students: loadRoster(),
      lessonsBySubject: MOCK_LESSONS_BY_SUBJECT,
      progressRecords: loadProgress(),
      remediationMaterials: loadRemediation(),
    };
  }

  async authenticate(): Promise<void> {}

  async saveQuizAttempt(w: QuizAttemptWrite): Promise<void> {
    const records = loadProgress();
    const record = records[w.lrn] ? { ...records[w.lrn] } : emptyRecord(w.lrn);
    record.quizAttempts = {
      ...record.quizAttempts,
      [w.topicId]: {
        topicId: w.topicId,
        score: w.score,
        perfectScore: w.perfectScore,
        answers: w.answers,
        completedAt: new Date().toISOString().split('T')[0],
      },
    };
    record.completedTopicIds = record.completedTopicIds.includes(w.topicId)
      ? record.completedTopicIds
      : [...record.completedTopicIds, w.topicId];
    records[w.lrn] = record;
    saveProgress(records);
  }

  async saveSummativeResult(w: SummativeWrite): Promise<void> {
    const records = loadProgress();
    const record = records[w.lrn] ? { ...records[w.lrn] } : emptyRecord(w.lrn);
    const percent = Math.round((w.score / 20) * 100);
    record.summativeScores = {
      ...record.summativeScores,
      [w.lessonId]: { score: w.score, perfectScore: 20, feedback: summativeFeedback(percent) },
    };
    records[w.lrn] = record;
    saveProgress(records);
  }

  async publishRemediation(
    material: TeacherRemediationMaterial,
    opts: { subject: string; section: string },
  ): Promise<void> {
    const targetSection = material.targetSection || opts.section;
    const persisted = { ...material, targetSection };
    const list = loadRemediation().filter((m) => m.id !== material.id);
    localStorage.setItem(REMEDIATION_KEY, JSON.stringify([persisted, ...list]));
  }

  async generateRemediation(req: GenerateRemediationReq): Promise<GeneratedRemediation> {
    const topic = findTopic(req.originalTopicId);
    if (!topic) {
      return {
        title: 'Remedial Topic',
        content: 'Review the topic and try the quiz again.',
        teacherNotes: `Custom review pack for ${req.studentName}.`,
        createdQuiz: [],
      };
    }
    return {
      title: `Remedial Topic: ${topic.name}`,
      content: buildRemedialContent(topic),
      teacherNotes: `Custom review pack on ${topic.name} for ${req.studentName}. Read through, then take the quick check.`,
      createdQuiz: topic.quiz.slice(0, 3),
    };
  }

  async generateTopicQuiz(req: { topicId: string; subject: string; n?: number }): Promise<QuizQuestion[]> {
    const topic = findTopic(req.topicId);
    if (!topic) return [];
    return topic.quiz.slice(0, req.n ?? topic.quiz.length);
  }

  async enrollStudent(student: StudentUser): Promise<void> {
    const roster = loadRoster();
    if (!roster.some((s) => s.lrn === student.lrn)) {
      localStorage.setItem(ROSTER_KEY, JSON.stringify([...roster, withSection(student)]));
    }
  }

  subscribeLive(): void {}
  unsubscribeLive(): void {}
}
