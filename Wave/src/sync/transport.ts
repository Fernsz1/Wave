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
import { Chunk, fragment, Reassembler } from './chunk';

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

/**
 * Raw byte channel a radio implements: a shared broadcast medium (every node
 * hears every frame), exactly like a LoRa link. A `LoopbackFrameLink` backs
 * tests/demo; a real driver swaps in here without touching `LoRaTransport`.
 */
export interface FrameLink {
  send(frame: Uint8Array): void;
  onFrame(cb: (frame: Uint8Array) => void): void;
}

/** In-process shared bus: all transports attached to one instance hear each other. */
export class LoopbackFrameLink implements FrameLink {
  private listeners: ((frame: Uint8Array) => void)[] = [];
  send(frame: Uint8Array): void {
    // Copy so a sender mutating its buffer can't affect receivers (radio semantics).
    for (const cb of this.listeners) cb(frame.slice());
  }
  onFrame(cb: (frame: Uint8Array) => void): void {
    this.listeners.push(cb);
  }
}

/**
 * LoRa transport: the same Transport interface as MqttTransport, but the envelope
 * (already carrying a DEFLATE-compressed payload) is serialized and `fragment`ed
 * into <=200-byte BYTE frames for the radio, then reassembled on the far side.
 * There are no broker topics on a shared radio — routing is by the per-frame
 * topic header plus the standard envelope fields the app already encodes.
 */
export class LoRaTransport implements Transport {
  private handlers: { glob: string; handler: MessageHandler }[] = [];
  private reassembler = new Reassembler();
  private enc = new TextEncoder();
  private dec = new TextDecoder();

  constructor(private link: FrameLink, private frameSize = 200) {
    this.link.onFrame((frame) => this.onFrame(frame));
  }

  publish(topic: string, tokens: Token[]): void {
    const serialized = JSON.stringify(tokens);
    const msgId = String((tokens[1] as Token) ?? `${Date.now()}`); // envelope msgId
    for (const c of fragment(msgId, serialized, this.frameSize)) {
      // Compact per-frame header so the receiver can route + reassemble.
      const wire = JSON.stringify([topic, c.msgId, c.index, c.total, c.data]);
      this.link.send(this.enc.encode(wire));
    }
  }

  private onFrame(frame: Uint8Array): void {
    let arr: [string, string, number, number, string];
    try {
      arr = JSON.parse(this.dec.decode(frame));
    } catch {
      return;
    }
    const [topic, msgId, index, total, data] = arr;
    const chunk: Chunk = { msgId, index, total, data };
    const serialized = this.reassembler.add(chunk);
    if (serialized === null) return; // still waiting on frames
    let tokens: Token[];
    try {
      tokens = JSON.parse(serialized);
    } catch {
      return;
    }
    for (const { glob, handler } of this.handlers) {
      if (matches(glob, topic)) handler(topic, tokens);
    }
  }

  subscribe(topicGlob: string, handler: MessageHandler): void {
    this.handlers.push({ glob: topicGlob, handler });
  }

  unsubscribeAll(): void {
    this.handlers = [];
  }

  onReconnect(_cb: () => void): void {
    /* a radio link has no connect lifecycle in this stub */
  }

  close(): void {
    this.handlers = [];
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
