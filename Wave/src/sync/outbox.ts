/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Offline-first outbox: queues "up" messages when the transport is unavailable
 * and flushes them on reconnect. Persisted via a pluggable store (localStorage
 * in the browser so the queue survives reloads; in-memory for tests). Can be
 * upgraded to IndexedDB without touching callers.
 */
import { Token } from '../protocol/codec';

export interface OutboxItem {
  id: string;
  topic: string;
  tokens: Token[];
}

export interface OutboxStore {
  load(): OutboxItem[];
  save(items: OutboxItem[]): void;
}

export class MemoryStore implements OutboxStore {
  private items: OutboxItem[] = [];
  load() {
    return [...this.items];
  }
  save(items: OutboxItem[]) {
    this.items = [...items];
  }
}

export class LocalStorageStore implements OutboxStore {
  constructor(private key = 'wave_outbox') {}
  load(): OutboxItem[] {
    try {
      return JSON.parse(localStorage.getItem(this.key) || '[]');
    } catch {
      return [];
    }
  }
  save(items: OutboxItem[]) {
    localStorage.setItem(this.key, JSON.stringify(items));
  }
}

export class Outbox {
  private items: OutboxItem[];

  constructor(private store: OutboxStore) {
    this.items = store.load();
  }

  get pending(): number {
    return this.items.length;
  }

  enqueue(topic: string, tokens: Token[]): void {
    this.items.push({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, topic, tokens });
    this.store.save(this.items);
  }

  /** Attempt to send everything; keeps any item whose send throws. */
  flush(send: (topic: string, tokens: Token[]) => void): number {
    const remaining: OutboxItem[] = [];
    let sent = 0;
    for (const item of this.items) {
      try {
        send(item.topic, item.tokens);
        sent++;
      } catch {
        remaining.push(item);
      }
    }
    this.items = remaining;
    this.store.save(this.items);
    return sent;
  }

  /** Async variant: awaits each send, keeps any that reject. Returns count sent. */
  async flushAsync(send: (topic: string, tokens: Token[]) => Promise<void>): Promise<number> {
    const remaining: OutboxItem[] = [];
    let sent = 0;
    for (const item of this.items) {
      try {
        await send(item.topic, item.tokens);
        sent++;
      } catch {
        remaining.push(item);
      }
    }
    this.items = remaining;
    this.store.save(this.items);
    return sent;
  }
}
