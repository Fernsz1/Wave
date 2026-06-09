/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Deterministic, subject-agnostic summative feedback derived purely from the
 * score band. Both the student client (App.tsx) and the server
 * (wave_api/ingest.py) compute this identically, so the teacher always sees the
 * same feedback the student saw — without adding a field to the wire protocol.
 *
 * Keep these bands in sync with `summative_feedback` in server/wave_api/ingest.py.
 */
export function summativeFeedback(percent: number): string {
  if (percent >= 90) return 'Excellent mastery.';
  if (percent >= 60) return 'Good effort — light review recommended.';
  return 'Needs targeted review.';
}
