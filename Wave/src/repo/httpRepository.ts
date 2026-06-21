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
import { decode, Token } from '../protocol/codec';
import { SCHEMA_BY_TYPE } from '../schemas';
import { buildEnvelope, parseEnvelope } from '../sync/envelope';
import { Outbox, LocalStorageStore } from '../sync/outbox';
import { MqttTransport, Transport } from '../sync/transport';
import { topicFor, slug } from '../sync/topics';
import { Lesson, QuizQuestion, StudentProgress, StudentUser, TeacherUser, TeacherRemediationMaterial } from '../types';
import { GeneratedRemediation, GenerateRemediationReq, LoginResult, RepoBootstrap, SubscribeOpts, QuizAttemptWrite, SummativeWrite, WaveRepository } from './repository';

const SUBJECTS = ['science', 'mathematics', 'english'];
/** Demo-only fallback PIN when a caller omits one (e.g. quick-enroll without a PIN field). */
const DEFAULT_DEMO_PIN = '123456';

export class HttpRepository implements WaveRepository {
  readonly isLive = true;
  private token = '';
  private transport: Transport | null = null;
  private outbox = new Outbox(new LocalStorageStore());

  constructor(
    private apiBase: string,
    private mqttUrl: string | null,
  ) {}

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

  private async post(path: string, body: Record<string, any>): Promise<any> {
    const res = await fetch(`${this.apiBase}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
    return res.json();
  }

  async login(role: 'student' | 'teacher', principalId: string, passwordOrPin: string): Promise<LoginResult> {
    const body =
      role === 'student' ? { role, lrn: principalId, pin: passwordOrPin } : { role, teacherId: principalId, password: passwordOrPin };
    const res = await fetch(`${this.apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || 'Login failed. Please try again.' };
    this.token = data.token;
    const user: StudentUser | TeacherUser =
      role === 'student'
        ? { lrn: data.user.lrn, name: data.user.name, gradeLevel: data.user.gradeLevel, section: data.user.section, pin: passwordOrPin }
        : { teacherId: data.user.teacherId, name: data.user.name, department: data.user.department, password: passwordOrPin };
    return { ok: true, user };
  }

  async bootstrap(): Promise<RepoBootstrap> {
    const roster = await this.get('/api/roster');
    const students: StudentUser[] = roster.students ?? [];
    const teachers: TeacherUser[] = roster.teachers ?? [];

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

    return { students, teachers, lessonsBySubject, progressRecords, remediationMaterials };
  }

  private validatedProgress(tokens: Token[]): StudentProgress | null {
    const obj = decode('StudentProgress', tokens);
    const parsed = SCHEMA_BY_TYPE.StudentProgress.safeParse(obj);
    return parsed.success ? (parsed.data as unknown as StudentProgress) : null;
  }

  private toInternalRemediation(tokens: Token[]): TeacherRemediationMaterial | null {
    return this.toInternalRemediationObj(decode('TeacherRemediationMaterial', tokens));
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
          perfectScore: 10,
          answers: w.answers,
          completedAt: new Date().toISOString().split('T')[0],
          lessonId: w.lessonId,
        },
      },
      quizScores: {},
      summativeScores: {},
    };
    await this.push('StudentProgress', progress, w.subject, w.section);
  }

  async saveSummativeResult(w: SummativeWrite): Promise<void> {
    const passed = w.score >= 12;
    const results = {
      studentLrn: w.lrn,
      section: w.section,
      lessonId: w.lessonId,
      score: w.score,
      total: 20,
      percent: Math.round((w.score / 20) * 100),
      passed,
      failedItems: w.failedItems ?? [],
      feedback: passed ? 'Good job! You passed the summative assessment.' : 'Keep reviewing the topics and ask your teacher for help.',
    };
    await this.push('StudentSummativeResults', results, w.subject, w.section);
  }

  async fetchRemediation(section?: string): Promise<TeacherRemediationMaterial[]> {
    const url = section ? `/api/remediation?section=${encodeURIComponent(section)}` : '/api/remediation';
    const rem = await this.get(url);
    return (rem.items as Token[][])
      .map((t) => this.toInternalRemediation(t))
      .filter((m): m is TeacherRemediationMaterial => m !== null);
  }

  async generateRemediation(req: GenerateRemediationReq): Promise<GeneratedRemediation> {
    const topicIds = req.topicIds ?? (req.topicId ? [req.topicId] : []);
    const data = await this.post('/api/remediation/generate', {
      subject: req.subject,
      originalTopicId: req.topicId ?? topicIds[0] ?? '',
      topicIds,
      studentName: req.studentName,
      gradeLevel: req.gradeLevel,
      section: req.section,
      prompt: req.prompt,
      lessonOnly: req.lessonOnly ?? false,
      failedItems: req.failedItems ?? [],
    });

    // Map Title
    const title = data.lesson_title || data.title || 'Remedial Lesson';

    // Map structured sections from the AI `concepts` (header_title/explanation).
    let sections: { title: string; body: string }[] = [];
    if (data.concepts && Array.isArray(data.concepts)) {
      sections = data.concepts.map((c: any) => ({ title: c.header_title ?? '', body: c.explanation ?? '' }));
    }

    // Map Content (flattened markdown) from sections, for storage/display.
    let content = '';
    if (sections.length > 0) {
      content = sections.map((s) => `## ${s.title}\n\n${s.body}`).join('\n\n');
    } else {
      content = data.content || '';
    }

    // Map Teacher Notes
    let teacherNotes = '';
    const notesList = data.teachers_notes || [];
    const gapPrefix = data.learning_gap ? `**Learning Gap:** ${data.learning_gap}\n` : '';
    if (notesList.length > 0) {
      teacherNotes = [gapPrefix, ...notesList.map((note: string) => `• ${note}`)].filter(Boolean).join('\n');
    } else {
      teacherNotes = data.teacherNotes || '';
    }

    // Map Quiz Questions
    let createdQuiz: QuizQuestion[] = [];
    if (data.summative_test && Array.isArray(data.summative_test)) {
      createdQuiz = data.summative_test.map((q: any, idx: number) => {
        const options = q.choices || [];
        const correctIdx = options.indexOf(q.correct_answer);
        return {
          id: `q-diag-${idx + 1}`,
          question: q.question,
          options: options,
          correctAnswerIndex: correctIdx !== -1 ? correctIdx : 0,
          explanation: `Correct choice: ${q.correct_answer}`
        };
      });
    } else if (data.createdQuiz && Array.isArray(data.createdQuiz)) {
      createdQuiz = data.createdQuiz;
    }

    return {
      title,
      content,
      teacherNotes,
      createdQuiz,
      lessonNumber: data.lesson_number,
      learningGap: data.learning_gap,
      teachersNotes: data.teachers_notes || [],
      sections,
    };
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
      createdSummative: material.createdSummative ?? [],
      publishDate: material.publishDate,
      targetSection: material.targetSection || opts.section,
      chunks: [],
      isPublished: material.isPublished,
      subject: opts.subject,
    };
    await this.push('TeacherRemediationMaterial', wire, opts.subject, wire.targetSection);
  }

  async flushPendingWrites(): Promise<void> {
    await this.flushOutbox();
  }

  async enrollStudent(student: StudentUser): Promise<void> {
    const signup = {
      lrn: student.lrn,
      name: student.name,
      gradeLevel: student.gradeLevel,
      section: student.section || student.gradeLevel,
      pin: student.pin || DEFAULT_DEMO_PIN,
    };
    await this.push('StudentSignup', signup, '', signup.section);
  }

  subscribeLive(opts: SubscribeOpts): void {
    if (!this.mqttUrl) return;
    if (!this.transport) {
      this.transport = new MqttTransport(this.mqttUrl);
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

    // "All Sections" → subscribe to every section with a single wildcard
    if (opts.section && opts.section !== 'All Sections') {
      this.transport.subscribe(`wave/${slug(opts.section)}/#`, onMsg);
    } else if (!opts.lrn) {
      this.transport.subscribe('wave/#', onMsg);
    }
    if (opts.lrn) this.transport.subscribe(`wave/${opts.lrn}/#`, onMsg);
    // Always listen for section-wide broadcasts (e.g. remedial material published to "All Sections")
    if (opts.lrn) this.transport.subscribe('wave/all-sections/#', onMsg);
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
      createdSummative: w.createdSummative,
      publishDate: w.publishDate,
      targetSection: w.targetSection,
      targetSubject: w.subject,
      isPublished: w.isPublished,
    };
  }
}
