import type { JsonValue, PatchObject } from "./types.js";
import { deepClone } from "./utils.js";

export class PatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PatchError";
  }
}

function unescapePointer(segment: string): string {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

function normalizePointer(pointer: string): string {
  return pointer.startsWith("/") ? pointer : `/${pointer}`;
}

function splitPointer(pointer: string): string[] {
  const normalized = normalizePointer(pointer);
  if (normalized === "/") return [];
  return normalized
    .split("/")
    .slice(1)
    .map(unescapePointer);
}

function validatePrefixConflicts(pointers: string[]): void {
  const normalized = pointers.map(normalizePointer).sort();
  for (let i = 0; i < normalized.length; i += 1) {
    const current = normalized[i];
    for (let j = i + 1; j < normalized.length; j += 1) {
      const other = normalized[j];
      if (other && other.startsWith(`${current}/`)) {
        throw new PatchError(`Patch pointer conflict: ${current} is prefix of ${other}`);
      }
    }
  }
}

function assertNotArray(value: JsonValue | object | null, pointer: string): void {
  if (Array.isArray(value)) {
    throw new PatchError(`Patch pointer references into array: ${pointer}`);
  }
}

function assertObject(value: JsonValue | object | null, pointer: string): asserts value is Record<string, JsonValue> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new PatchError(`Patch pointer references missing or non-object path: ${pointer}`);
  }
}

function assertRecord(value: object, pointer: string): asserts value is Record<string, JsonValue> {
  if (value === null || Array.isArray(value)) {
    throw new PatchError(`Patch pointer references missing or non-object path: ${pointer}`);
  }
}

export function applyPatch<T extends object>(input: T, patch: PatchObject): T {
  const pointers = Object.keys(patch);
  validatePrefixConflicts(pointers);

  const target = deepClone(input);
  assertRecord(target, "/");

  for (const [rawPointer, value] of Object.entries(patch)) {
    const pointer = normalizePointer(rawPointer);
    const segments = splitPointer(pointer);

  let current: Record<string, JsonValue> = target;
    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i];
      if (segment === undefined) {
        throw new PatchError(`Patch pointer missing segment: ${pointer}`);
      }
      const isLast = i === segments.length - 1;

      assertNotArray(current, pointer);
      assertRecord(current, pointer);

      if (isLast) {
        if (value === null) {
          if (Object.prototype.hasOwnProperty.call(current, segment)) {
            delete current[segment];
          }
        } else {
          current[segment] = value;
        }
      } else {
        if (!Object.prototype.hasOwnProperty.call(current, segment)) {
          throw new PatchError(`Patch pointer missing path: ${pointer}`);
        }
        const next = current[segment];
        if (next === undefined) {
          throw new PatchError(`Patch pointer missing path: ${pointer}`);
        }
        assertObject(next, pointer);
        current = next;
      }
    }
  }

  return target;
}
