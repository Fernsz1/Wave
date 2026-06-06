/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Topic scheme — must stay identical to server/wave_api/mqtt.py. */
export function slug(section: string): string {
  return section.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function topicFor(msgType: string, key: string): string {
  return `wave/${key.includes(' ') ? slug(key) : key}/${msgType}`;
}
