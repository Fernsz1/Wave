/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Zod schemas for the canonical wire models (mirror protocol/wire_manifest.json).
 * Used to VALIDATE objects decoded from the codec at the sync boundary — a frame
 * off MQTT/LoRa is untrusted input. Types are inferred so there is one source of
 * truth for the wire shapes; the UI's internal types stay in ./types.ts.
 */
import { z } from 'zod';

export const SubjectSchema = z.enum(['science', 'mathematics', 'english']);
export const ModeSchema = z.enum(['topic', 'summative', 'remedial']);

export const QuizQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(z.string()),
  correctAnswerIndex: z.number().int(),
  explanation: z.string(),
});

export const StudentQuizAttemptSchema = z.object({
  topicId: z.string(),
  score: z.number().int(),
  perfectScore: z.number().int(),
  answers: z.array(z.number().int()),
  completedAt: z.string(),
});

export const QuizScoreSchema = z.object({
  score: z.number().int(),
  total: z.number().int(),
  percent: z.number().int(),
  passed: z.boolean(),
});

export const SummativeScoreSchema = z.object({
  score: z.number().int(),
  perfectScore: z.number().int(),
  feedback: z.string(),
  attempts: z.number().int().optional(),
});

export const FailedItemSchema = z.object({
  questionId: z.string(),
  topicId: z.string(),
  selectedOption: z.number().int(),
  correctOption: z.number().int(),
});

export const StandingSchema = z.object({
  rank: z.number().int(),
  studentLrn: z.string(),
  name: z.string(),
  score: z.number().int(),
  perfect: z.number().int(),
  percent: z.number().int(),
});

export const StudentSignupSchema = z.object({
  lrn: z.string(),
  name: z.string(),
  gradeLevel: z.string(),
  section: z.string(),
  pin: z.string(),
});

export const TeacherSignupSchema = z.object({
  teacherId: z.string(),
  name: z.string(),
  department: z.string(),
});

export const StudentProgressSchema = z.object({
  studentLrn: z.string(),
  section: z.string(),
  completedTopicIds: z.array(z.string()),
  quizAttempts: z.record(z.string(), StudentQuizAttemptSchema),
  quizScores: z.record(z.string(), QuizScoreSchema),
  summativeScores: z.record(z.string(), SummativeScoreSchema),
});

export const StudentSummativeResultsSchema = z.object({
  studentLrn: z.string(),
  section: z.string(),
  lessonId: z.string(),
  score: z.number().int(),
  total: z.number().int(),
  percent: z.number().int(),
  passed: z.boolean(),
  failedItems: z.array(FailedItemSchema),
});

export const RankingsSchema = z.object({
  section: z.string(),
  subject: SubjectSchema,
  standings: z.array(StandingSchema),
});

export const ChunkSchema = z.object({
  index: z.number().int(),
  total: z.number().int(),
  data: z.string(),
});

export const TeacherRemediationMaterialSchema = z.object({
  id: z.string(),
  originalTopicId: z.string(),
  title: z.string(),
  content: z.string(),
  teacherNotes: z.string(),
  createdQuiz: z.array(QuizQuestionSchema),
  createdSummative: z.array(QuizQuestionSchema).optional(),
  publishDate: z.string(),
  targetSection: z.string(),
  chunks: z.array(ChunkSchema),
  isPublished: z.boolean(),
});

export const DefinitionSchema = z.object({ term: z.string(), meaning: z.string() });
export const ContentSectionSchema = z.object({
  title: z.string(),
  body: z.string(),
  codeExample: z.string().optional(),
});
export const TopicContentSchema = z.object({
  introduction: z.string(),
  sections: z.array(ContentSectionSchema),
  definition: DefinitionSchema.optional(),
  keyTakeaway: z.string(),
  importantNote: z.string().optional(),
});
export const TopicSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  readingTime: z.string(),
  isCustomRemedial: z.boolean().optional(),
  content: TopicContentSchema,
  quiz: z.array(QuizQuestionSchema),
});
export const LessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  topics: z.array(TopicSchema),
  summative: z.array(QuizQuestionSchema),
});
export const LessonCatalogSchema = z.object({
  subject: SubjectSchema,
  lessons: z.array(LessonSchema),
});

/** type name -> schema, for validating codec.decode() output by message type. */
export const SCHEMA_BY_TYPE = {
  StudentSignup: StudentSignupSchema,
  TeacherSignup: TeacherSignupSchema,
  StudentProgress: StudentProgressSchema,
  StudentSummativeResults: StudentSummativeResultsSchema,
  Rankings: RankingsSchema,
  TeacherRemediationMaterial: TeacherRemediationMaterialSchema,
  LessonCatalog: LessonCatalogSchema,
} as const;

export type WireStudentProgress = z.infer<typeof StudentProgressSchema>;
export type WireRankings = z.infer<typeof RankingsSchema>;
export type WireRemediation = z.infer<typeof TeacherRemediationMaterialSchema>;
export type WireLessonCatalog = z.infer<typeof LessonCatalogSchema>;
export type WireLesson = z.infer<typeof LessonSchema>;
