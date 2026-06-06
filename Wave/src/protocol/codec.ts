/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tokenized-array codec — TS side.
 *
 * Encodes/decodes objects to compact positional arrays using the SHARED
 * `protocol/wire_manifest.json`. The Python codec (`server/wave_api/codec.py`)
 * is a line-for-line mirror, so the app and server decode identical arrays over
 * MQTT today and LoRa later. Field ORDER comes only from the manifest — never
 * hand-order anything here.
 */
import manifest from '@protocol/wire_manifest.json';

export type Token = string | number | boolean | null | Token[];

interface FieldDef {
  name: string;
  t: string;
  optional?: boolean;
}
interface TypeDef {
  tag?: number;
  fields: FieldDef[];
}

const MESSAGES = manifest.messages as Record<string, TypeDef>;
const DEFS = manifest.defs as Record<string, TypeDef>;
const ENUMS = manifest.enums as Record<string, string[]>;

export const PROTOCOL_VERSION = manifest.protocolVersion as number;

function resolveDef(name: string): TypeDef {
  const def = MESSAGES[name] ?? DEFS[name];
  if (!def) throw new Error(`codec: unknown type "${name}"`);
  return def;
}

const SCALARS = new Set(['str', 'int', 'bool']);

/** Encode a single value given its manifest type token. */
function encodeValue(t: string, value: any): Token {
  if (value === undefined || value === null) return null;

  if (SCALARS.has(t)) return value as Token;

  if (t === 'array') return value as Token; // raw passthrough (envelope payload)

  if (t.startsWith('enum:')) {
    const dict = ENUMS[t.slice(5)];
    const idx = dict.indexOf(value);
    if (idx < 0) throw new Error(`codec: value "${value}" not in enum ${t}`);
    return idx;
  }

  if (t.startsWith('array:')) {
    const elem = t.slice(6);
    return (value as any[]).map((v) => encodeValue(elem, v));
  }

  if (t.startsWith('map:')) {
    const elem = t.slice(4);
    return Object.entries(value as Record<string, any>).map(
      ([k, v]) => [k, encodeValue(elem, v)] as Token,
    );
  }

  // ref to a message/def
  return encodeFields(resolveDef(t).fields, value);
}

function decodeValue(t: string, token: Token): any {
  if (token === null || token === undefined) return undefined;

  if (SCALARS.has(t)) return token;

  if (t === 'array') return token; // raw passthrough

  if (t.startsWith('enum:')) {
    const dict = ENUMS[t.slice(5)];
    return dict[token as number];
  }

  if (t.startsWith('array:')) {
    const elem = t.slice(6);
    return (token as Token[]).map((v) => decodeValue(elem, v));
  }

  if (t.startsWith('map:')) {
    const elem = t.slice(4);
    const out: Record<string, any> = {};
    for (const pair of token as Token[]) {
      const [k, v] = pair as Token[];
      out[k as string] = decodeValue(elem, v);
    }
    return out;
  }

  return decodeFields(resolveDef(t).fields, token as Token[]);
}

export function encodeFields(fields: FieldDef[], obj: Record<string, any>): Token[] {
  return fields.map((f) => encodeValue(f.t, obj?.[f.name]));
}

export function decodeFields(fields: FieldDef[], arr: Token[]): Record<string, any> {
  const out: Record<string, any> = {};
  fields.forEach((f, i) => {
    const decoded = decodeValue(f.t, arr[i]);
    if (decoded !== undefined) out[f.name] = decoded;
  });
  return out;
}

/** Encode a named message/def into its positional token array. */
export function encode(typeName: string, obj: Record<string, any>): Token[] {
  return encodeFields(resolveDef(typeName).fields, obj);
}

/** Decode a positional token array back into an object for a named type. */
export function decode<T = Record<string, any>>(typeName: string, arr: Token[]): T {
  return decodeFields(resolveDef(typeName).fields, arr) as T;
}

export function typeTag(typeName: string): number {
  const tag = MESSAGES[typeName]?.tag;
  if (tag === undefined) throw new Error(`codec: "${typeName}" has no tag (not a top-level message)`);
  return tag;
}

export const ENVELOPE_FIELDS = (manifest.envelope as TypeDef).fields;

export function encodeEnvelope(env: Record<string, any>): Token[] {
  return encodeFields(ENVELOPE_FIELDS, env);
}

export function decodeEnvelope(arr: Token[]): Record<string, any> {
  return decodeFields(ENVELOPE_FIELDS, arr);
}
