/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Durable client-side cache mirroring the server's logical model. It lets the
 * app cold-start and operate with NO reachable server — the condition that LoRa
 * imposes — by hydrating the last-known catalog/roster/progress/remediation.
 *
 * Backed by IndexedDB in the browser (survives reloads, larger quota than
 * localStorage) and an in-memory map in tests / non-browser runtimes. The
 * pluggable backend mirrors the OutboxStore pattern in ../sync/outbox.ts.
 */
import { Lesson, StudentProgress, StudentUser, TeacherUser, TeacherRemediationMaterial } from '../types';

export interface CachedBootstrap {
  students: StudentUser[];
  teachers: TeacherUser[];
  lessonsBySubject: Record<string, Lesson[]>;
  progressRecords: Record<string, StudentProgress>;
  remediationMaterials: TeacherRemediationMaterial[];
}

export interface WaveLocalStore {
  /** Last-known full snapshot, or null if nothing has been cached yet. */
  loadBootstrap(): Promise<CachedBootstrap | null>;
  saveBootstrap(b: CachedBootstrap): Promise<void>;
  /** Merge one student's progress into the cached snapshot. */
  putProgress(record: StudentProgress): Promise<void>;
  /** Upsert one remediation material into the cached snapshot. */
  putRemediation(material: TeacherRemediationMaterial): Promise<void>;
}

const EMPTY: CachedBootstrap = {
  students: [],
  teachers: [],
  lessonsBySubject: {},
  progressRecords: {},
  remediationMaterials: [],
};

/** Minimal async key->value backend. */
interface Kv {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
}

class MemoryKv implements Kv {
  private map = new Map<string, string>();
  async get<T>(key: string): Promise<T | null> {
    const raw = this.map.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.map.set(key, JSON.stringify(value));
  }
}

const DB_NAME = 'wave';
const STORE_NAME = 'kv';

class IndexedDbKv implements Kv {
  private dbp: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbp) {
      this.dbp = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbp;
  }

  async get<T>(key: string): Promise<T | null> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async set<T>(key: string, value: T): Promise<void> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

const BOOTSTRAP_KEY = 'bootstrap';

class KvLocalStore implements WaveLocalStore {
  constructor(private kv: Kv) {}

  async loadBootstrap(): Promise<CachedBootstrap | null> {
    return this.kv.get<CachedBootstrap>(BOOTSTRAP_KEY);
  }

  async saveBootstrap(b: CachedBootstrap): Promise<void> {
    await this.kv.set(BOOTSTRAP_KEY, b);
  }

  async putProgress(record: StudentProgress): Promise<void> {
    const b = (await this.loadBootstrap()) ?? { ...EMPTY };
    b.progressRecords = {
      ...b.progressRecords,
      [record.studentLrn]: { ...b.progressRecords[record.studentLrn], ...record },
    };
    await this.saveBootstrap(b);
  }

  async putRemediation(material: TeacherRemediationMaterial): Promise<void> {
    const b = (await this.loadBootstrap()) ?? { ...EMPTY };
    b.remediationMaterials = [material, ...b.remediationMaterials.filter((m) => m.id !== material.id)];
    await this.saveBootstrap(b);
  }
}

/** In-memory store — handy for tests and SSR. */
export function createMemoryLocalStore(): WaveLocalStore {
  return new KvLocalStore(new MemoryKv());
}

/** Pick IndexedDB when available, else fall back to memory (tests / Node). */
export function createLocalStore(): WaveLocalStore {
  if (typeof indexedDB !== 'undefined') return new KvLocalStore(new IndexedDbKv());
  return createMemoryLocalStore();
}
