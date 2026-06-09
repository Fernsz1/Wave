/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StudentUser } from './types';

/**
 * Canonical section key for a student. `section` is the single source of truth
 * everywhere (teacher filtering, student remediation visibility, up-sync, and
 * the server). It falls back to `gradeLevel` only when a record predates the
 * canonical field — seed rosters are normalized so `section` is always set.
 */
export function sectionOf(student: Pick<StudentUser, 'section' | 'gradeLevel'>): string {
  return student.section || student.gradeLevel;
}

/** Normalize a roster so every student carries an explicit canonical `section`. */
export function withSection(student: StudentUser): StudentUser {
  return { ...student, section: sectionOf(student) };
}
