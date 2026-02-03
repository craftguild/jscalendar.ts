import type { PatchLike, PatchValue } from "./types.js";
import { deepClone } from "./utils.js";

const POINTER_SEPARATOR = "/";
const TYPE_OBJECT = "object";
const PATCH_ERROR_NAME = "PatchError";

/**
 * Error thrown when a patch operation is invalid.
 */
export class PatchError extends Error {
  /**
   * Create a new PatchError.
   * @param message Error message.
   */
  constructor(message: string) {
    super(message);
    this.name = PATCH_ERROR_NAME;
  }
}

/**
 * Unescape a JSON Pointer segment.
 * @param segment Escaped pointer segment.
 * @return Unescaped pointer segment.
 */
function unescapePointer(segment: string): string {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

/**
 * Normalize a JSON Pointer string to ensure it is absolute.
 * @param pointer Pointer to normalize.
 * @return Normalized pointer.
 */
function normalizePointer(pointer: string): string {
  return pointer.startsWith(POINTER_SEPARATOR)
    ? pointer
    : `${POINTER_SEPARATOR}${pointer}`;
}

/**
 * Split a JSON Pointer into unescaped segments.
 * @param pointer Pointer to split.
 * @return Unescaped pointer segments.
 */
function splitPointer(pointer: string): string[] {
  const normalized = normalizePointer(pointer);
  if (normalized === POINTER_SEPARATOR) return [];
  return normalized
    .split(POINTER_SEPARATOR)
    .slice(1)
    .map(unescapePointer);
}

/**
 * Validate that no pointer is a prefix of another pointer.
 * @param pointers Patch pointers to validate.
 * @return Nothing.
 */
function validatePrefixConflicts(pointers: string[]): void {
  const normalized = pointers.map(normalizePointer).sort();
  for (let i = 0; i < normalized.length; i += 1) {
    const current = normalized[i];
    for (let j = i + 1; j < normalized.length; j += 1) {
      const other = normalized[j];
      const prefix = `${current}${POINTER_SEPARATOR}`;
      if (other && other.startsWith(prefix)) {
        throw new PatchError(`Patch pointer conflict: ${current} is prefix of ${other}`);
      }
    }
  }
}

/**
 * Ensure the value is not an array when traversing pointers.
 * @param value Value to check.
 * @param pointer Pointer for error context.
 * @return Nothing.
 */
function assertNotArray(value: PatchValue | object | null, pointer: string): void {
  if (Array.isArray(value)) {
    throw new PatchError(`Patch pointer references into array: ${pointer}`);
  }
}

/**
 * Ensure a value is an object record for traversal.
 * @param value Value to check.
 * @param pointer Pointer for error context.
 * @return Nothing.
 */
function assertObject(value: PatchValue | object | null, pointer: string): asserts value is Record<string, PatchValue> {
  if (value === null || typeof value !== TYPE_OBJECT || Array.isArray(value)) {
    throw new PatchError(`Patch pointer references missing or non-object path: ${pointer}`);
  }
}

/**
 * Ensure a value is a record at the current traversal position.
 * @param value Value to check.
 * @param pointer Pointer for error context.
 * @return Nothing.
 */
function assertRecord(value: object, pointer: string): asserts value is Record<string, PatchValue> {
  if (value === null || Array.isArray(value)) {
    throw new PatchError(`Patch pointer references missing or non-object path: ${pointer}`);
  }
}

/**
 * Apply a PatchObject to a target record.
 * @param target Target record to mutate.
 * @param patch Patch entries to apply.
 * @return Nothing.
 */
function applyPatchEntries(target: Record<string, PatchValue>, patch: PatchLike): void {
  for (const [rawPointer, value] of Object.entries(patch)) {
    const pointer = normalizePointer(rawPointer);
    const segments = splitPointer(pointer);
    applyPointerSegments(target, pointer, segments, value);
  }
}

/**
 * Apply patch segments to the target by walking each segment.
 * @param target Target record to mutate.
 * @param pointer Normalized pointer.
 * @param segments Pointer segments.
 * @param value Patch value for the pointer.
 * @return Nothing.
 */
function applyPointerSegments(
  target: Record<string, PatchValue>,
  pointer: string,
  segments: string[],
  value: PatchValue,
): void {
  let current = target;
  for (let i = 0; i < segments.length; i += 1) {
    const segment = ensureSegment(segments[i], pointer);
    const isLast = isLastSegment(i, segments.length);
    current = applySegment(current, segment, isLast, value, pointer);
  }
}

/**
 * Ensure the current segment is present.
 * @param segment Segment to validate.
 * @param pointer Pointer for error context.
 * @return Validated segment.
 */
function ensureSegment(segment: string | undefined, pointer: string): string {
  if (segment === undefined) {
    throw new PatchError(`Patch pointer missing segment: ${pointer}`);
  }
  return segment;
}

/**
 * Determine if the index is the last segment.
 * @param index Current index.
 * @param length Total number of segments.
 * @return True if this is the last segment.
 */
function isLastSegment(index: number, length: number): boolean {
  return index === length - 1;
}

/**
 * Apply a single patch segment and return the next traversal record.
 * @param current Current record.
 * @param segment Current segment.
 * @param isLast Whether this is the last segment.
 * @param value Patch value.
 * @param pointer Pointer for error context.
 * @return Next record to traverse.
 */
function applySegment(
  current: Record<string, PatchValue>,
  segment: string,
  isLast: boolean,
  value: PatchValue,
  pointer: string,
): Record<string, PatchValue> {
  assertNotArray(current, pointer);
  assertRecord(current, pointer);

  if (isLast) {
    applyValueAtSegment(current, segment, value);
    return current;
  }

  return getNextRecord(current, segment, pointer);
}

/**
 * Apply a value update or delete at the given segment.
 * @param current Current record.
 * @param segment Segment to update.
 * @param value Patch value.
 * @return Nothing.
 */
function applyValueAtSegment(current: Record<string, PatchValue>, segment: string, value: PatchValue): void {
  if (value === null) {
    if (Object.prototype.hasOwnProperty.call(current, segment)) {
      delete current[segment];
    }
    return;
  }
  current[segment] = value;
}

/**
 * Resolve the next record in the traversal, validating it exists and is an object.
 * @param current Current record.
 * @param segment Segment to traverse.
 * @param pointer Pointer for error context.
 * @return Next record to traverse.
 */
function getNextRecord(
  current: Record<string, PatchValue>,
  segment: string,
  pointer: string,
): Record<string, PatchValue> {
  if (!Object.prototype.hasOwnProperty.call(current, segment)) {
    throw new PatchError(`Patch pointer missing path: ${pointer}`);
  }
  const next = current[segment];
  if (next === undefined) {
    throw new PatchError(`Patch pointer missing path: ${pointer}`);
  }
  assertObject(next, pointer);
  return next;
}

/**
 * Apply a JSCalendar PatchObject to an input object.
 * @param input Input object.
 * @param patch Patch object to apply.
 * @return Patched clone of the input object.
 */
export function applyPatch<T extends object>(input: T, patch: PatchLike): T {
  const pointers = Object.keys(patch);
  validatePrefixConflicts(pointers);

  const target = deepClone(input);
  assertRecord(target, POINTER_SEPARATOR);

  applyPatchEntries(target, patch);
  return target;
}
