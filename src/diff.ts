import type { EventObject } from "./jscal/event.js";
import type { GroupObject } from "./jscal/group.js";
import type { TaskObject } from "./jscal/task.js";
import type {
    Event,
    Group,
    JSCalendarObject,
    PatchObject,
    PatchValue,
    Task,
} from "./types.js";

const POINTER_SEPARATOR = "/";
const TYPE_OBJECT = "object";

export type EventDiffInput = Event | EventObject | { data: Event };
export type TaskDiffInput = Task | TaskObject | { data: Task };
export type GroupDiffInput = Group | GroupObject | { data: Group };
export type DiffInput = EventDiffInput | TaskDiffInput | GroupDiffInput;

/**
 * Create a JSCalendar PatchObject from two JSCalendar objects.
 * @param before Original object or JsCal instance.
 * @param after Updated object or JsCal instance.
 * @return PatchObject that changes before into after.
 */
export function diff(
    before: EventDiffInput,
    after: EventDiffInput,
): PatchObject;
export function diff(before: TaskDiffInput, after: TaskDiffInput): PatchObject;
export function diff(
    before: GroupDiffInput,
    after: GroupDiffInput,
): PatchObject;
export function diff(before: DiffInput, after: DiffInput): PatchObject {
    const beforeObject = normalizeDiffInput(before);
    const afterObject = normalizeDiffInput(after);
    assertSameType(beforeObject, afterObject);
    const patch: PatchObject = {};
    collectDiff(beforeObject, afterObject, [], patch);
    return patch;
}

/**
 * Normalize a JSCalendar object or JsCal instance to plain data.
 * @param input JSCalendar object or JsCal instance.
 * @return Plain JSCalendar object.
 */
function normalizeDiffInput(input: DiffInput): JSCalendarObject {
    if ("data" in input) return input.data;
    return input;
}

/**
 * Assert both inputs have the same JSCalendar object type.
 * @param before Original object.
 * @param after Updated object.
 * @return Nothing.
 */
function assertSameType(
    before: JSCalendarObject,
    after: JSCalendarObject,
): void {
    if (before["@type"] !== after["@type"]) {
        throw new Error(
            `Cannot diff ${before["@type"]} against ${after["@type"]}`,
        );
    }
}

/**
 * Collect changed values into a patch object.
 * @param before Original value.
 * @param after Updated value.
 * @param path Current path segments.
 * @param patch PatchObject to mutate.
 * @return Nothing.
 */
function collectDiff(
    before: PatchValue | undefined,
    after: PatchValue | undefined,
    path: string[],
    patch: PatchObject,
): void {
    if (isEqualValue(before, after)) return;
    if (after === undefined) {
        setPatchValue(path, null, patch);
        return;
    }
    if (isPlainObject(before) && isPlainObject(after)) {
        collectObjectDiff(before, after, path, patch);
        return;
    }
    setPatchValue(path, after, patch);
}

/**
 * Collect object property changes.
 * @param before Original object.
 * @param after Updated object.
 * @param path Current path segments.
 * @param patch PatchObject to mutate.
 * @return Nothing.
 */
function collectObjectDiff(
    before: Record<string, PatchValue | undefined>,
    after: Record<string, PatchValue | undefined>,
    path: string[],
    patch: PatchObject,
): void {
    for (const key of unionKeys(before, after)) {
        collectDiff(
            recordValue(before, key),
            recordValue(after, key),
            [...path, key],
            patch,
        );
    }
}

/**
 * Get the union of object keys.
 * @param left First object.
 * @param right Second object.
 * @return Sorted unique keys.
 */
function unionKeys(left: object, right: object): string[] {
    return Array.from(
        new Set([...Object.keys(left), ...Object.keys(right)]),
    ).sort();
}

/**
 * Get a record value by key.
 * @param value Source object.
 * @param key Property key.
 * @return Property value.
 */
function recordValue(
    value: Record<string, PatchValue | undefined>,
    key: string,
): PatchValue | undefined {
    return value[key];
}

/**
 * Check whether a value is a non-array object.
 * @param value Input value.
 * @return True when the value can be traversed as an object.
 */
function isPlainObject(
    value: PatchValue | undefined,
): value is Record<string, PatchValue | undefined> {
    return (
        value !== null && typeof value === TYPE_OBJECT && !Array.isArray(value)
    );
}

/**
 * Set a value in a PatchObject.
 * @param path Patch path segments.
 * @param value Patch value.
 * @param patch PatchObject to mutate.
 * @return Nothing.
 */
function setPatchValue(
    path: string[],
    value: PatchValue | null,
    patch: PatchObject,
): void {
    patch[formatPatchPath(path)] = value;
}

/**
 * Format path segments as a PatchObject key.
 * @param path Patch path segments.
 * @return PatchObject key.
 */
function formatPatchPath(path: string[]): string {
    return path.map(escapePointerSegment).join(POINTER_SEPARATOR);
}

/**
 * Escape a JSON Pointer segment.
 * @param segment Raw path segment.
 * @return Escaped path segment.
 */
function escapePointerSegment(segment: string): string {
    return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

/**
 * Check JSON-compatible value equality.
 * @param before Original value.
 * @param after Updated value.
 * @return True when the values are equal.
 */
function isEqualValue(
    before: PatchValue | undefined,
    after: PatchValue | undefined,
): boolean {
    return JSON.stringify(before) === JSON.stringify(after);
}
