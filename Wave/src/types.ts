/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'student' | 'teacher';

export interface StudentUser {
  lrn: string;
  name: string;
  gradeLevel: string;
  section?: string; // canonical section; defaults to gradeLevel when absent
  pin?: string;
}

export interface TeacherUser {
  teacherId: string;
  name: string;
  department: string;
  password?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  readingTime: string; // e.g. "5 mins"
  content: {
    introduction: string;
    sections: {
      title: string;
      body: string;
      codeExample?: string;
    }[];
    definition?: {
      term: string;
      meaning: string;
    };
    keyTakeaway: string;
    importantNote?: string;
  };
  quiz: QuizQuestion[];
  isCustomRemedial?: boolean;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  topics: Topic[];
  summative: QuizQuestion[]; // 40-item lesson-level exam, separate from topic quizzes
}

export interface SubjectCatalog {
  subject: string;
  /** Static-mock data only (data.ts) — the live LessonCatalog wire shape has no equivalent field. */
  gradeLevel: string;
  lessons: Lesson[];
}

export interface StudentQuizAttempt {
  topicId: string;
  score: number; // e.g., 8
  perfectScore: number; // e.g., 10
  answers: number[]; // user-selected indices
  completedAt: string;
  attempts?: number; // how many times this topic quiz has been submitted (max 3)
  lessonId?: string; // which lesson this topic belongs to
}

export interface QuizScore {
  score: number;
  total: number;
  percent: number;
  passed: boolean;
}

export interface FailedItem {
  questionId: string;
  topicId: string;
  selectedOption: number;
  correctOption: number;
}

export interface StudentProgress {
  studentLrn: string;
  section?: string; // canonical section, emitted by the server-side derive step
  completedTopicIds: string[];
  quizAttempts: Record<string, StudentQuizAttempt>; // topicId -> attempt
  quizScores?: Record<string, QuizScore>; // topicId -> server-derived score, when synced live
  summativeScores: Record<string, {
    score: number;
    total: number;
    feedback: string;
    attempts?: number;
    percent?: number;
    passed?: boolean;
    failedItems?: FailedItem[];
  }>; // lessonId -> score
}

export interface TeacherRemediationMaterial {
  id: string;
  originalTopicId: string;
  title: string;
  content: string;
  teacherNotes: string;
  createdSummative?: QuizQuestion[]; // 20-item summative (remedial has no separate quiz)
  publishDate: string;
  targetSection?: string;
  targetSubject?: string;
  learningGap?: string;
  isPublished: boolean;
}
