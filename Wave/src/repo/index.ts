/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HttpRepository } from './httpRepository';
import { MockRepository } from './mockRepository';
import { WaveRepository } from './repository';

/**
 * Pick the repository implementation from the environment:
 * - `VITE_API_BASE` set  -> HttpRepository (syncs with Django; MQTT for live down)
 * - unset                -> MockRepository (today's offline, in-memory behavior)
 */
export function createRepository(): WaveRepository {
  const apiBase = import.meta.env.VITE_API_BASE as string | undefined;
  const mqttUrl = (import.meta.env.VITE_MQTT_URL as string | undefined) ?? null;
  if (apiBase) return new HttpRepository(apiBase, mqttUrl);
  return new MockRepository();
}

export * from './repository';
