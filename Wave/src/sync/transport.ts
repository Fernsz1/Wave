/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Transport abstraction for the live pub/sub channel. `MqttTransport` is the
 * concrete LoRa stand-in (mqtt.js over WebSocket -> Mosquitto, the proven demo
 * path); `LoRaTransport` will implement the same interface later. `InMemoryTransport`
 * backs unit tests. Payloads are JSON-serialized tokenized arrays.
 */
import mqtt, { MqttClient } from 'mqtt';
import { Token, decodeEnvelope } from '../protocol/codec';
import { topicFor } from './topics';

export type MessageHandler = (topic: string, tokens: Token[]) => void;

export interface Transport {
  publish(topic: string, tokens: Token[]): void;
  subscribe(topicGlob: string, handler: MessageHandler): void;
  /** Drop all current subscriptions/handlers without closing the connection. */
  unsubscribeAll(): void;
  /** Register a callback invoked whenever the underlying link (re)connects. */
  onReconnect(cb: () => void): void;
  close(): void;
}

export class MqttTransport implements Transport {
  private client: MqttClient;
  private handlers: { glob: string; handler: MessageHandler }[] = [];
  private subscribedGlobs = new Set<string>();
  private reconnectCbs: (() => void)[] = [];

  constructor(url: string, clientId = `wave-app-${Math.random().toString(16).slice(2, 8)}`) {
    this.client = mqtt.connect(url, { clientId, reconnectPeriod: 2000 });
    this.client.on('message', (topic, payload) => {
      let tokens: Token[];
      try {
        tokens = JSON.parse(payload.toString());
      } catch {
        return;
      }
      for (const { glob, handler } of this.handlers) {
        if (matches(glob, topic)) handler(topic, tokens);
      }
    });
    // 'connect' fires on the first connect and on every reconnect — the signal to flush the outbox.
    this.client.on('connect', () => {
      for (const cb of this.reconnectCbs) cb();
    });
  }

  publish(topic: string, tokens: Token[]): void {
    this.client.publish(topic, JSON.stringify(tokens), { qos: 1, retain: true });
  }

  subscribe(topicGlob: string, handler: MessageHandler): void {
    this.handlers.push({ glob: topicGlob, handler });
    this.subscribedGlobs.add(topicGlob);
    this.client.subscribe(topicGlob, { qos: 1 });
  }

  unsubscribeAll(): void {
    for (const glob of this.subscribedGlobs) this.client.unsubscribe(glob);
    this.subscribedGlobs.clear();
    this.handlers = [];
  }

  onReconnect(cb: () => void): void {
    this.reconnectCbs.push(cb);
  }

  close(): void {
    this.client.end();
  }
}

/**
 * LoRa transport (student side). The student device has no broker reachable —
 * it sits on the Raspberry Pi's Wi-Fi AP, across the LoRa link from the server.
 * Instead it POLLS the Pi's HTTP cache (`GET /api/sync?section=<slug>`), which
 * holds the tokenized envelopes the Pi reassembled from LoRa. Uplinks
 * (`publish`) POST the tokenized array back to the Pi, which ships it to town
 * over LoRa. Implements the same `Transport` interface as `MqttTransport`, so
 * the repository's subscribe/dispatch path is reused unchanged.
 */
export class HttpPollTransport implements Transport {
  private handlers: { glob: string; handler: MessageHandler }[] = [];
  private sections = new Set<string>(); // section slugs to poll
  private seen = new Set<string>(); // msgIds already delivered (dedupe)
  private timer: ReturnType<typeof setInterval> | null = null;
  private reconnectCbs: (() => void)[] = [];
  private firstPollDone = false;

  constructor(
    private piBase: string,
    private pollMs = 3000,
  ) {
    this.piBase = piBase.replace(/\/+$/, '');
  }

  publish(_topic: string, tokens: Token[]): void {
    // Student uplink: POST the tokenized envelope array to the Pi.
    void fetch(`${this.piBase}/api/uplink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokens),
    }).catch(() => {
      /* offline — outbox will retry on the next reconnect signal */
    });
  }

  subscribe(topicGlob: string, handler: MessageHandler): void {
    this.handlers.push({ glob: topicGlob, handler });
    // Extract a concrete section slug from globs like `wave/<slug>/#`. Wildcard
    // (`+`/`#`) and lrn-only keys simply yield no cache hits, which is harmless.
    const key = topicGlob.split('/')[1];
    if (key && key !== '+' && key !== '#') this.sections.add(key);
    this.ensurePolling();
  }

  unsubscribeAll(): void {
    this.handlers = [];
    this.sections.clear();
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  onReconnect(cb: () => void): void {
    this.reconnectCbs.push(cb);
  }

  close(): void {
    this.unsubscribeAll();
  }

  private ensurePolling(): void {
    if (this.timer) return;
    void this.pollOnce();
    this.timer = setInterval(() => void this.pollOnce(), this.pollMs);
  }

  private async pollOnce(): Promise<void> {
    const sections = [...this.sections];
    let reachable = false;
    for (const section of sections) {
      try {
        const res = await fetch(`${this.piBase}/api/sync?section=${encodeURIComponent(section)}`);
        if (!res.ok) continue;
        reachable = true;
        const envelopes = (await res.json()) as Token[][];
        for (const tokens of envelopes) this.dispatch(tokens);
      } catch {
        /* Pi unreachable this tick — try again next interval */
      }
    }
    // Fire the reconnect/flush signal once the link is first usable.
    if (reachable && !this.firstPollDone) {
      this.firstPollDone = true;
      for (const cb of this.reconnectCbs) cb();
    }
  }

  private dispatch(tokens: Token[]): void {
    let meta: Record<string, any>;
    try {
      meta = decodeEnvelope(tokens);
    } catch {
      return;
    }
    if (!meta.msgId || this.seen.has(meta.msgId)) return;
    this.seen.add(meta.msgId);
    // Synthesize the MQTT-style topic so the existing glob handlers route it.
    const topic = topicFor(meta.type, meta.section ?? '');
    for (const { glob, handler } of this.handlers) {
      if (matches(glob, topic)) handler(topic, tokens);
    }
  }
}

/** Loopback transport for tests: publishing delivers synchronously to matching subs. */
export class InMemoryTransport implements Transport {
  private subs: { glob: string; handler: MessageHandler }[] = [];
  retained = new Map<string, Token[]>();

  publish(topic: string, tokens: Token[]): void {
    this.retained.set(topic, tokens);
    for (const { glob, handler } of this.subs) {
      if (matches(glob, topic)) handler(topic, tokens);
    }
  }

  subscribe(topicGlob: string, handler: MessageHandler): void {
    this.subs.push({ glob: topicGlob, handler });
    // Deliver retained messages to a fresh subscriber (broker behavior).
    for (const [topic, tokens] of this.retained) {
      if (matches(topicGlob, topic)) handler(topic, tokens);
    }
  }

  unsubscribeAll(): void {
    this.subs = [];
  }

  onReconnect(_cb: () => void): void {
    /* in-memory transport never disconnects */
  }

  close(): void {
    this.subs = [];
  }
}

/** MQTT topic-filter match supporting '+' (one level) and '#' (multi level). */
export function matches(filter: string, topic: string): boolean {
  const f = filter.split('/');
  const t = topic.split('/');
  for (let i = 0; i < f.length; i++) {
    if (f[i] === '#') return true;
    if (f[i] === '+') {
      if (t[i] === undefined) return false;
      continue;
    }
    if (f[i] !== t[i]) return false;
  }
  return f.length === t.length;
}
