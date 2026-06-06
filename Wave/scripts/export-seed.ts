/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * One-off exporter: dumps the frontend mock data into JSON seed files the Django
 * server loads, so the server's catalog/roster/progress match the app exactly.
 * Run with:  npx tsx scripts/export-seed.ts
 */
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  MOCK_STUDENTS,
  MOCK_TEACHERS,
  MOCK_LESSONS_BY_SUBJECT,
  INITIAL_PROGRESS_RECORDS,
  INITIAL_REMEDIATION_MATERIALS,
} from '../src/data';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../../server/wave_api/seed');
mkdirSync(outDir, { recursive: true });

const write = (name: string, data: unknown) => {
  writeFileSync(resolve(outDir, name), JSON.stringify(data, null, 2), 'utf-8');
  console.log('wrote', name);
};

write('catalog.json', MOCK_LESSONS_BY_SUBJECT);
write('students.json', MOCK_STUDENTS.map((s) => ({ ...s, pin: s.pin ?? '123456' })));
write('teachers.json', MOCK_TEACHERS);
write('progress.json', INITIAL_PROGRESS_RECORDS);
write('remediation.json', INITIAL_REMEDIATION_MATERIALS);
