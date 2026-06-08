/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Deterministic quiz expander.
 *
 * Every topic is normalized to exactly QUIZ_SIZE (10) questions so the student
 * quiz, the seeded progress, and the teacher's records all agree on the same
 * denominator. Questions are derived from each topic's OWN content (definition,
 * key takeaway, sections, description), with distractors drawn from a global
 * pool of sibling-topic facts so they're plausible but wrong. Output is fully
 * deterministic (seeded by topic id), so the runtime catalog and the exported
 * server seed are byte-identical.
 */
import { Lesson, QuizQuestion, StudentProgress, Topic } from './types';

export const QUIZ_SIZE = 10;

/** Rescale seeded quiz attempts so every perfectScore matches QUIZ_SIZE (keeps the ratio). */
export function scaleProgressToQuizSize(
  records: Record<string, StudentProgress>,
): Record<string, StudentProgress> {
  const out: Record<string, StudentProgress> = {};
  for (const [lrn, rec] of Object.entries(records)) {
    const quizAttempts: StudentProgress['quizAttempts'] = {};
    for (const [topicId, att] of Object.entries(rec.quizAttempts)) {
      const ratio = att.perfectScore > 0 ? att.score / att.perfectScore : 0;
      quizAttempts[topicId] = { ...att, score: Math.round(ratio * QUIZ_SIZE), perfectScore: QUIZ_SIZE };
    }
    out[lrn] = { ...rec, quizAttempts };
  }
  return out;
}

// ── deterministic PRNG (mulberry32) ──────────────────────────────────────────
function hashString(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const firstSentence = (s: string) => (s.split(/[.\n]/)[0] || s).trim();

interface Pools {
  terms: string[];
  meanings: string[];
  takeaways: string[];
  names: string[];
  notes: string[];
  sectionTitles: string[];
  intros: string[];
}

function collectPools(bySubject: Record<string, Lesson[]>): Pools {
  const p: Pools = { terms: [], meanings: [], takeaways: [], names: [], notes: [], sectionTitles: [], intros: [] };
  for (const lessons of Object.values(bySubject)) {
    for (const l of lessons) {
      for (const t of l.topics) {
        p.names.push(t.name);
        if (t.content?.definition) {
          p.terms.push(t.content.definition.term);
          p.meanings.push(t.content.definition.meaning);
        }
        if (t.content?.keyTakeaway) p.takeaways.push(t.content.keyTakeaway);
        if (t.content?.importantNote) p.notes.push(t.content.importantNote);
        if (t.content?.introduction) p.intros.push(t.content.introduction);
        for (const s of t.content?.sections ?? []) p.sectionTitles.push(s.title);
      }
    }
  }
  return p;
}

/** Pick `n` distinct distractors from `pool` excluding `correct`, deterministically. */
function pickDistractors(pool: string[], correct: string, n: number, rand: () => number): string[] {
  const candidates = Array.from(new Set(pool.filter((x) => x && x !== correct)));
  // Fisher–Yates with the seeded rng
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return candidates.slice(0, n);
}

function buildMcq(
  id: string,
  question: string,
  correct: string,
  pool: string[],
  explanation: string,
  rand: () => number,
): QuizQuestion | null {
  const distractors = pickDistractors(pool, correct, 3, rand);
  if (distractors.length < 3) return null; // not enough plausible options
  const options = [correct, ...distractors];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { id, question, options, correctAnswerIndex: options.indexOf(correct), explanation };
}

function generateForTopic(topic: Topic, pools: Pools): QuizQuestion[] {
  const rand = mulberry32(hashString(topic.id));
  const out: QuizQuestion[] = [...(topic.quiz ?? [])]; // keep the hand-written ones first
  const seen = new Set(out.map((q) => q.question.trim()));
  const c = topic.content;

  const add = (q: QuizQuestion | null) => {
    if (q && !seen.has(q.question.trim())) {
      seen.add(q.question.trim());
      out.push(q);
    }
  };

  let n = 0;
  const nid = () => `${topic.id}-G${++n}`;

  // Content-derived questions (each fact → one question).
  if (c?.definition) {
    add(buildMcq(nid(), `In "${topic.name}", what does the term "${c.definition.term}" mean?`, c.definition.meaning, pools.meanings, `"${c.definition.term}" — ${c.definition.meaning}`, rand));
    add(buildMcq(nid(), `Which term is defined as: "${c.definition.meaning}"?`, c.definition.term, pools.terms, `That is the definition of "${c.definition.term}".`, rand));
  }
  if (c?.keyTakeaway) {
    add(buildMcq(nid(), `Which statement best summarizes the topic "${topic.name}"?`, c.keyTakeaway, pools.takeaways, `Key takeaway for ${topic.name}.`, rand));
  }
  add(buildMcq(nid(), `Which topic is described as: "${topic.description}"?`, topic.name, pools.names, `That description matches "${topic.name}".`, rand));
  if (c?.importantNote) {
    add(buildMcq(nid(), `Which is an important point to remember about "${topic.name}"?`, c.importantNote, [...pools.notes, ...pools.takeaways], `Important note for ${topic.name}.`, rand));
  }
  for (const s of c?.sections ?? []) {
    add(buildMcq(nid(), `In "${topic.name}", which section covers: "${firstSentence(s.body)}"?`, s.title, pools.sectionTitles, `That is discussed under "${s.title}".`, rand));
  }
  if (c?.introduction) {
    add(buildMcq(nid(), `What is "${topic.name}" mainly about?`, firstSentence(c.introduction), pools.intros.map(firstSentence), `Overview of ${topic.name}.`, rand));
  }

  // Pad to QUIZ_SIZE with valid, uniquely-stemmed review questions if needed.
  const reviewFacts = [c?.keyTakeaway, c?.definition?.meaning, topic.description, c?.importantNote].filter(Boolean) as string[];
  let review = 0;
  while (out.length < QUIZ_SIZE && reviewFacts.length) {
    const correct = reviewFacts[review % reviewFacts.length];
    review++;
    const q = buildMcq(`${topic.id}-R${review}`, `Review ${review}: which statement is true about "${topic.name}"?`, correct, [...pools.takeaways, ...pools.meanings, ...pools.intros.map(firstSentence)], `Review item for ${topic.name}.`, rand);
    // Force-unique stem (Review N) so it always adds.
    if (q) out.push(q);
    else break;
  }

  return out.slice(0, QUIZ_SIZE);
}

/** Return a deep copy of the catalog with every topic normalized to QUIZ_SIZE questions. */
export function expandLessons(bySubject: Record<string, Lesson[]>): Record<string, Lesson[]> {
  const pools = collectPools(bySubject);
  const out: Record<string, Lesson[]> = {};
  for (const [subject, lessons] of Object.entries(bySubject)) {
    out[subject] = lessons.map((l) => ({
      ...l,
      topics: l.topics.map((t) => ({ ...t, quiz: generateForTopic(t, pools) })),
    }));
  }
  return out;
}
