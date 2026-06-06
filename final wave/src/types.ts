/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'student' | 'teacher';

export interface StudentUser {
  lrn: string;
  name: string;
  gradeLevel: string;
  pin?: string;
}

export interface TeacherUser {
  teacherId: string;
  name: string;
  department: string;
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
}

export interface StudentQuizAttempt {
  topicId: string;
  score: number; // e.g., 8
  perfectScore: number; // e.g., 10
  answers: number[]; // user-selected indices
  completedAt: string;
}

export interface StudentProgress {
  studentLrn: string;
  completedTopicIds: string[];
  quizAttempts: Record<string, StudentQuizAttempt>; // topicId -> attempt
  summativeScores: Record<string, { score: number; perfectScore: number; feedback: string }>; // lessonId -> score
}

export interface TeacherRemediationMaterial {
  id: string;
  originalTopicId: string;
  title: string;
  content: string;
  teacherNotes: string;
  createdQuiz: QuizQuestion[];
  publishDate: string;
  assignedStudentLrn: string; // specific student who needs remediation
  isPublished: boolean;
}
