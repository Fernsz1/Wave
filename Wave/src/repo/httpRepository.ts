/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Server-backed repository. Reads/writes go over REST (request/response) carrying
 * tokenized arrays; live "down" updates (rankings, remediation, peers' progress)
 * arrive over MQTT — the proven last-mile path. Writes that fail offline are
 * queued in the outbox and flushed on the next successful call.
 */
import { decode, encode, Token } from '../protocol/codec';
import { SCHEMA_BY_TYPE } from '../schemas';
import { buildEnvelope, parseEnvelope } from '../sync/envelope';
import { Outbox, LocalStorageStore, OutboxStore } from '../sync/outbox';
import { MqttTransport, Transport } from '../sync/transport';
import { topicFor, slug } from '../sync/topics';
import { withSection, sectionOf } from '../section';
import { Lesson, QuizQuestion, StudentProgress, StudentUser, TeacherRemediationMaterial } from '../types';
import {
  RepoBootstrap,
  RepoUpdate,
  SubscribeOpts,
  QuizAttemptWrite,
  SummativeWrite,
  WaveRepository,
  GenerateRemediationReq,
  GeneratedRemediation,
} from './repository';

const SUBJECTS = ['science', 'mathematics', 'english'];

/** Optional injection points (used by tests; production uses the defaults). */
export interface HttpRepositoryDeps {
  transport?: Transport;
  outboxStore?: OutboxStore;
}

export class HttpRepository implements WaveRepository {
  readonly isLive = true;
  private token = '';
  private transport: Transport | null = null;
  private outbox: Outbox;
  private injectedTransport: Transport | null;

  constructor(
    private apiBase: string,
    private mqttUrl: string | null,
    deps: HttpRepositoryDeps = {},
  ) {
    this.injectedTransport = deps.transport ?? null;
    this.outbox = new Outbox(deps.outboxStore ?? new LocalStorageStore());
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) h.Authorization = `Token ${this.token}`;
    return h;
  }

  private async get(path: string): Promise<any> {
    const res = await fetch(`${this.apiBase}${path}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
    return res.json();
  }

  private async postJson(path: string, body: Record<string, any>): Promise<any> {
    const res = await fetch(`${this.apiBase}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
    return res.json();
  }

  async generateRemediation(req: GenerateRemediationReq): Promise<GeneratedRemediation> {
    return this.postJson('/api/remediation/generate', req);
  }

  async generateTopicQuiz(req: { topicId: string; subject: string; n?: number }): Promise<QuizQuestion[]> {
    const res = await this.postJson('/api/quiz/generate', req);
    return res.quiz as QuizQuestion[];
  }

  async authenticate(role: 'student' | 'teacher', principalId: string, name?: string): Promise<void> {
    const body =
      role === 'student'
        ? { role, lrn: principalId, pin: '123456' }
        : { role, teacherId: principalId, name };
    const res = await fetch(`${this.apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) this.token = (await res.json()).token;
  }

  async bootstrap(): Promise<RepoBootstrap> {
    const roster = await this.get('/api/roster');
    const students: StudentUser[] = (roster.students as StudentUser[]).map(withSection);

    const lessonsBySubject: Record<string, Lesson[]> = {};
    for (const subject of SUBJECTS) {
      const cat = await this.get(`/api/catalog?subject=${subject}`);
      lessonsBySubject[subject] = decode<{ lessons: Lesson[] }>('LessonCatalog', cat.tokens).lessons;
    }

    const progressRecords: Record<string, StudentProgress> = {};
    const all = await this.get('/api/allprogress');
    for (const tokens of all.records as Token[][]) {
      const p = this.validatedProgress(tokens);
      if (p) progressRecords[p.studentLrn] = p;
    }

    const rem = await this.get('/api/remediation');
    const remediationMaterials = (rem.items as Token[][])
      .map((t) => this.toInternalRemediation(t))
      .filter((m): m is TeacherRemediationMaterial => m !== null);

    return { students, lessonsBySubject, progressRecords, remediationMaterials };
  }

  private validatedProgress(tokens: Token[]): StudentProgress | null {
    const obj = decode('StudentProgress', tokens);
    const parsed = SCHEMA_BY_TYPE.StudentProgress.safeParse(obj);
    return parsed.success ? (parsed.data as unknown as StudentProgress) : null;
  }

  private toInternalRemediation(tokens: Token[]): TeacherRemediationMaterial | null {
    const obj = decode('TeacherRemediationMaterial', tokens);
    const parsed = SCHEMA_BY_TYPE.TeacherRemediationMaterial.safeParse(obj);
    if (!parsed.success) return null;
    const w = parsed.data;
    return {
      id: w.id,
      originalTopicId: w.originalTopicId,
      title: w.title,
      content: w.content,
      teacherNotes: w.teacherNotes,
      createdQuiz: w.createdQuiz,
      publishDate: w.publishDate,
      assignedStudentLrn: '',
      targetSection: w.targetSection,
      isPublished: w.isPublished,
    };
  }

  /** Push one envelope "up" over REST; queue to the outbox if the call fails. */
  private async push(type: string, obj: Record<string, any>, subject: string, section: string): Promise<void> {
    const env = buildEnvelope(type, obj, { direction: 'up', subject, section });
    await this.flushOutbox(); // drain anything queued while offline first
    try {
      await this.postEnvelope(env);
    } catch {
      this.outbox.enqueue(topicFor(type, section), env);
    }
  }

  /** Try to send every queued message; survivors stay queued. */
  private flushOutbox(): Promise<number> {
    return this.outbox.flushAsync((_t, tokens) => this.postEnvelope(tokens));
  }

  private async postEnvelope(env: Token[]): Promise<void> {
    const res = await fetch(`${this.apiBase}/api/sync/push`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ envelopes: [env] }),
    });
    if (!res.ok) throw new Error(`push -> ${res.status}`);
  }

  async saveQuizAttempt(w: QuizAttemptWrite): Promise<void> {
    const progress = {
      studentLrn: w.lrn,
      section: w.section,
      completedTopicIds: [w.topicId],
      quizAttempts: {
        [w.topicId]: {
          topicId: w.topicId,
          score: w.score,
          perfectScore: w.perfectScore,
          answers: w.answers,
          completedAt: new Date().toISOString().split('T')[0],
        },
      },
      quizScores: {},
      summativeScores: {},
    };
    await this.push('StudentProgress', progress, w.subject, w.section);
  }

  async saveSummativeResult(w: SummativeWrite): Promise<void> {
    const results = {
      studentLrn: w.lrn,
      section: w.section,
      lessonId: w.lessonId,
      score: w.score,
      total: 20,
      percent: Math.round((w.score / 20) * 100),
      passed: w.score >= 12,
      failedItems: [],
    };
    await this.push('StudentSummativeResults', results, w.subject, w.section);
  }

  async publishRemediation(
    material: TeacherRemediationMaterial,
    opts: { subject: string; section: string },
  ): Promise<void> {
    const wire = {
      id: material.id,
      originalTopicId: material.originalTopicId,
      title: material.title,
      content: material.content,
      teacherNotes: material.teacherNotes,
      createdQuiz: material.createdQuiz,
      publishDate: material.publishDate,
      targetSection: material.targetSection || opts.section,
      chunks: [],
      isPublished: material.isPublished,
    };
    await this.push('TeacherRemediationMaterial', wire, opts.subject, wire.targetSection);
  }

  async enrollStudent(student: StudentUser): Promise<void> {
    const signup = {
      lrn: student.lrn,
      name: student.name,
      gradeLevel: student.gradeLevel,
      section: sectionOf(student),
      pin: student.pin || '123456',
    };
    await this.push('StudentSignup', signup, '', signup.section);
  }

  subscribeLive(opts: SubscribeOpts): void {
    if (!this.mqttUrl && !this.injectedTransport) return;
    if (!this.transport) {
      this.transport = this.injectedTransport ?? new MqttTransport(this.mqttUrl as string);
      // On every (re)connect, drain any writes that were queued while offline.
      this.transport.onReconnect(() => void this.flushOutbox());
    }
    // Idempotent: drop any prior subscription so this call fully replaces it
    // (e.g. when the teacher switches the section they're viewing).
    this.transport.unsubscribeAll();

    const onMsg = (_topic: string, tokens: Token[]) => {
      const { meta, payload } = parseEnvelope<any>(tokens);
      if (meta.direction !== 'down') return;
      if (meta.type === 'StudentProgress') {
        const parsed = SCHEMA_BY_TYPE.StudentProgress.safeParse(payload);
        if (parsed.success) opts.onUpdate({ kind: 'progress', record: parsed.data as unknown as StudentProgress });
      } else if (meta.type === 'Rankings') {
        const parsed = SCHEMA_BY_TYPE.Rankings.safeParse(payload);
        if (parsed.success)
          opts.onUpdate({ kind: 'rankings', section: parsed.data.section, subject: parsed.data.subject, standings: parsed.data.standings });
      } else if (meta.type === 'TeacherRemediationMaterial') {
        const material = this.toInternalRemediationObj(payload);
        if (material) opts.onUpdate({ kind: 'remediation', material });
      }
    };

    if (opts.section) this.transport.subscribe(`wave/${slug(opts.section)}/#`, onMsg);
    if (opts.lrn) this.transport.subscribe(`wave/${opts.lrn}/#`, onMsg);
  }

  unsubscribeLive(): void {
    this.transport?.unsubscribeAll();
  }

  private toInternalRemediationObj(obj: any): TeacherRemediationMaterial | null {
    const parsed = SCHEMA_BY_TYPE.TeacherRemediationMaterial.safeParse(obj);
    if (!parsed.success) return null;
    const w = parsed.data;
    return {
      id: w.id,
      originalTopicId: w.originalTopicId,
      title: w.title,
      content: w.content,
      teacherNotes: w.teacherNotes,
      createdQuiz: w.createdQuiz,
      publishDate: w.publishDate,
      assignedStudentLrn: '',
      targetSection: w.targetSection,
      isPublished: w.isPublished,
    };
  }
}
