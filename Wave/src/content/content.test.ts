/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Seed content must validate against the canonical wire LessonSchema so it
 *  encodes/decodes cleanly over MQTT/LoRa and round-trips on both sides. */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import scienceData from './science.json';
import { LessonSchema } from '../schemas';

const Catalog = z.object({
  subject: z.string(),
  gradeLevel: z.string(),
  lessons: z.array(LessonSchema),
});

describe('Grade 7 science content', () => {
  it('matches the wire LessonSchema', () => {
    const parsed = Catalog.safeParse(scienceData);
    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues, null, 2)).toBe(true);
  });

  it('is Grade 7 and covers four quarters/lessons', () => {
    expect(scienceData.gradeLevel).toBe('Grade 7');
    expect(scienceData.lessons).toHaveLength(4);
  });

  it('every quiz option index is in range', () => {
    for (const lesson of scienceData.lessons) {
      const allQuizzes = [
        ...lesson.topics.flatMap((t) => t.quiz),
        ...lesson.summative,
      ];
      for (const q of allQuizzes) {
        expect(q.correctAnswerIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctAnswerIndex).toBeLessThan(q.options.length);
      }
    }
  });
});
