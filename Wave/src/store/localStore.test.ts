/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from 'vitest';
import { createMemoryLocalStore, CachedBootstrap } from './localStore';
import { StudentProgress, TeacherRemediationMaterial } from '../types';

const snapshot = (): CachedBootstrap => ({
  students: [],
  teachers: [],
  lessonsBySubject: { science: [] },
  progressRecords: {
    '101': { studentLrn: '101', completedTopicIds: ['L1-T1'], quizAttempts: {}, summativeScores: {} },
  },
  remediationMaterials: [],
});

describe('WaveLocalStore (memory backend)', () => {
  it('round-trips a bootstrap snapshot', async () => {
    const store = createMemoryLocalStore();
    expect(await store.loadBootstrap()).toBeNull();
    await store.saveBootstrap(snapshot());
    const got = await store.loadBootstrap();
    expect(got?.lessonsBySubject.science).toEqual([]);
    expect(got?.progressRecords['101'].completedTopicIds).toEqual(['L1-T1']);
  });

  it('merges progress by student lrn', async () => {
    const store = createMemoryLocalStore();
    await store.saveBootstrap(snapshot());
    const updated: StudentProgress = {
      studentLrn: '101',
      completedTopicIds: ['L1-T1', 'L1-T2'],
      quizAttempts: {},
      summativeScores: {},
    };
    await store.putProgress(updated);
    const got = await store.loadBootstrap();
    expect(got?.progressRecords['101'].completedTopicIds).toEqual(['L1-T1', 'L1-T2']);
  });

  it('upserts remediation without duplicating ids', async () => {
    const store = createMemoryLocalStore();
    const mat = (title: string): TeacherRemediationMaterial => ({
      id: 'REM-1',
      originalTopicId: 'L1-T1',
      title,
      content: 'c',
      teacherNotes: 'n',
      createdQuiz: [],
      publishDate: '2026-06-18',
      targetSection: 'Grade 7 - Section Rizal',
      isPublished: true,
    });
    await store.putRemediation(mat('v1'));
    await store.putRemediation(mat('v2'));
    const got = await store.loadBootstrap();
    expect(got?.remediationMaterials).toHaveLength(1);
    expect(got?.remediationMaterials[0].title).toBe('v2');
  });

  it('putProgress works from an empty store (no prior snapshot)', async () => {
    const store = createMemoryLocalStore();
    await store.putProgress({ studentLrn: '202', completedTopicIds: [], quizAttempts: {}, summativeScores: {} });
    const got = await store.loadBootstrap();
    expect(got?.progressRecords['202']).toBeDefined();
  });
});
