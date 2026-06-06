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
import { Token } from '../protocol/codec';

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
