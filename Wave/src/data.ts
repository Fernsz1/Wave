/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Lesson, SubjectCatalog } from './types';
import scienceData from './content/science.json';
import mathematicsData from './content/mathematics.json';
import englishData from './content/english.json';

export const SCIENCE_CATALOG: SubjectCatalog = scienceData as SubjectCatalog;
export const MATHEMATICS_CATALOG: SubjectCatalog = mathematicsData as SubjectCatalog;
export const ENGLISH_CATALOG: SubjectCatalog = englishData as SubjectCatalog;

export const MOCK_LESSONS: Lesson[] = SCIENCE_CATALOG.lessons;
export const MOCK_MATH_LESSONS: Lesson[] = MATHEMATICS_CATALOG.lessons;
export const MOCK_ENGLISH_LESSONS: Lesson[] = ENGLISH_CATALOG.lessons;

export const MOCK_LESSONS_BY_SUBJECT: Record<string, Lesson[]> = {
  science: MOCK_LESSONS,
  mathematics: MOCK_MATH_LESSONS,
  english: MOCK_ENGLISH_LESSONS,
};

export const SUBJECT_CATALOGS: SubjectCatalog[] = [
  SCIENCE_CATALOG,
  MATHEMATICS_CATALOG,
  ENGLISH_CATALOG,
];
