/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Dumps the lesson catalog to a JSON file the Django server can load.
 * Students, teachers, and progress are now seeded via `python manage.py seed_users`.
 * Run with:  npx tsx scripts/export-seed.ts
 */
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MOCK_LESSONS_BY_SUBJECT } from '../src/data';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../../server/wave_api/seed');
mkdirSync(outDir, { recursive: true });

const write = (name: string, data: unknown) => {
  writeFileSync(resolve(outDir, name), JSON.stringify(data, null, 2), 'utf-8');
  console.log('wrote', name);
};

write('catalog.json', MOCK_LESSONS_BY_SUBJECT);
