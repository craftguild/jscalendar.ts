import type {
    Event,
    JSCalendarObject,
    PatchLike,
    RecurrenceRule,
    Task,
    TimeZoneId,
} from "../types.js";
import { applyPatch } from "../patch.js";
import {
    dateTimeInTimeZone,
    localDateTimeFromDate,
    localDateTimeToUtcDate,
} from "../utils.js";
import { TYPE_EVENT, TYPE_TASK } from "./constants.js";
import type {
    RecurrenceExpandOptions,
    RecurrencePageOptions,
    RecurrenceRange,
} from "./types.js";
import { expandRule } from "./rules.js";

/**
 * Expand recurrence into occurrences sorted by recurrenceId/start.
 * @param items JSCalendar objects to expand.
 * @param range Date range bounds.
 * @param options Expansion options.
 * @return Generator of expanded occurrences.
 */
export function* expandRecurrence(
    items: JSCalendarObject[],
    range: RecurrenceRange,
    options: RecurrenceExpandOptions = {},
): Generator<JSCalendarObject> {
    const includeAnchor = options.includeAnchor ?? true;
    const streams = items.flatMap((item, index) =>
        createOccurrenceStreams(item, range, includeAnchor, index),
    );

    while (true) {
        const next = nextOccurrenceStream(streams);
        if (!next) {
            return;
        }
        yield next.current.value;
        advanceOccurrenceStream(streams, next);
    }
}

/**
 * Expand recurrence paged into occurrences.
 * @param items JSCalendar objects to expand.
 * @param range Date range bounds.
 * @param options Pagination options.
 * @return Page of expanded items plus an optional next cursor.
 */
export function expandRecurrencePaged(
    items: JSCalendarObject[],
    range: RecurrenceRange,
    options: RecurrencePageOptions,
): { items: JSCalendarObject[]; nextCursor?: string } {
    const result: JSCalendarObject[] = [];
    let nextCursor: string | undefined;

    for (const occurrence of expandRecurrence(items, range, options)) {
        const key = occurrenceKey(occurrence);
        if (options.cursor && key) {
            if (key <= options.cursor) {
                continue;
            }
        } else if (options.cursor && !key) {
            continue;
        }

        result.push(occurrence);
        if (key) {
            nextCursor = key;
        }
        if (result.length >= options.limit) {
            break;
        }
    }

    return { items: result, nextCursor };
}

/**
 * Expand event into occurrences.
 * @param event Event to expand.
 * @param range Date range bounds.
 * @param includeAnchor Whether the source event should be included.
 * @return Generator of expanded occurrences.
 */
function expandEvent(
    event: Event,
    range: RecurrenceRange,
    includeAnchor: boolean,
): Generator<JSCalendarObject> {
    return expandObject(
        event,
        range,
        event.start,
        event.recurrenceRules,
        event.excludedRecurrenceRules,
        event.recurrenceOverrides,
        event.timeZone ?? null,
        includeAnchor,
    );
}

/**
 * Expand task into occurrences.
 * @param task Task to expand.
 * @param range Date range bounds.
 * @param includeAnchor Whether the source task should be included.
 * @return Generator of expanded occurrences.
 */
function expandTask(
    task: Task,
    range: RecurrenceRange,
    includeAnchor: boolean,
): Generator<JSCalendarObject> {
    const anchor = task.start ?? task.due;
    if (!anchor) {
        return (function* empty() {})();
    }
    return expandObject(
        task,
        range,
        anchor,
        task.recurrenceRules,
        task.excludedRecurrenceRules,
        task.recurrenceOverrides,
        task.timeZone ?? null,
        includeAnchor,
    );
}

/**
 * Build a stable ordering key for an occurrence.
 * @param value Occurrence object.
 * @return Sort key or undefined when not available.
 */
function occurrenceKey(value: JSCalendarObject): string | undefined {
    if (value.recurrenceId) return value.recurrenceId;
    if (value["@type"] === TYPE_EVENT) return value.start;
    if (value["@type"] === TYPE_TASK) return value.start ?? value.due;
    return undefined;
}

type OccurrenceEntry = {
    value: JSCalendarObject;
    key?: string;
    sequence: number;
};

type OccurrenceStream = {
    index: number;
    iterator: Generator<JSCalendarObject>;
    current: OccurrenceEntry;
};

/**
 * Create occurrence streams for an item.
 * @param item JSCalendar object to expand.
 * @param range Date range bounds.
 * @param includeAnchor Whether the source item should be included.
 * @param index Stable source item index.
 * @return Initialized occurrence streams.
 */
function createOccurrenceStreams(
    item: JSCalendarObject,
    range: RecurrenceRange,
    includeAnchor: boolean,
    index: number,
): OccurrenceStream[] {
    const iterator =
        item["@type"] === TYPE_EVENT
            ? expandEvent(item, range, includeAnchor)
            : item["@type"] === TYPE_TASK
              ? expandTask(item, range, includeAnchor)
              : singleOccurrence(item);
    const first = iterator.next();
    if (first.done || first.value === undefined) {
        return [];
    }
    return [
        {
            index,
            iterator,
            current: {
                value: first.value,
                key: occurrenceKey(first.value),
                sequence: 0,
            },
        },
    ];
}

/**
 * Yield a single non-recurring occurrence.
 * @param item JSCalendar object to yield.
 * @return Generator with one occurrence.
 */
function* singleOccurrence(
    item: JSCalendarObject,
): Generator<JSCalendarObject> {
    yield item;
}

/**
 * Pick the next occurrence stream in global order.
 * @param streams Active occurrence streams.
 * @return Next stream to consume or undefined.
 */
function nextOccurrenceStream(
    streams: OccurrenceStream[],
): OccurrenceStream | undefined {
    let next: OccurrenceStream | undefined;
    for (const stream of streams) {
        if (!next || compareOccurrenceEntry(stream, next) < 0) {
            next = stream;
        }
    }
    return next;
}

/**
 * Compare two occurrence streams by their current entries.
 * @param left Left occurrence stream.
 * @param right Right occurrence stream.
 * @return Negative/zero/positive comparison result.
 */
function compareOccurrenceEntry(
    left: OccurrenceStream,
    right: OccurrenceStream,
): number {
    const leftKey = left.current.key;
    const rightKey = right.current.key;
    if (leftKey && rightKey) {
        const compared = leftKey.localeCompare(rightKey);
        if (compared !== 0) {
            return compared;
        }
    } else if (leftKey) {
        return -1;
    } else if (rightKey) {
        return 1;
    }

    if (left.index !== right.index) {
        return left.index - right.index;
    }
    return left.current.sequence - right.current.sequence;
}

/**
 * Advance a stream to its next occurrence or remove it when exhausted.
 * @param streams Active streams.
 * @param stream Stream to advance.
 * @return Nothing.
 */
function advanceOccurrenceStream(
    streams: OccurrenceStream[],
    stream: OccurrenceStream,
): void {
    const next = stream.iterator.next();
    if (next.done || next.value === undefined) {
        const index = streams.indexOf(stream);
        if (index >= 0) {
            streams.splice(index, 1);
        }
        return;
    }
    stream.current = {
        value: next.value,
        key: occurrenceKey(next.value),
        sequence: stream.current.sequence + 1,
    };
}

/**
 * Expand object into occurrences.
 * @param base Base JSCalendar object.
 * @param range Date range bounds.
 * @param anchor Anchor LocalDateTime for the series.
 * @param rules Inclusion recurrence rules.
 * @param excludedRules Exclusion recurrence rules.
 * @param overrides Recurrence overrides keyed by LocalDateTime.
 * @param recurrenceIdTimeZone Optional time zone for recurrence IDs.
 * @param includeAnchor Whether the source item should be included.
 * @return Generator of expanded occurrences.
 */
function* expandObject(
    base: JSCalendarObject,
    range: RecurrenceRange,
    anchor: string,
    rules?: RecurrenceRule[],
    excludedRules?: RecurrenceRule[],
    overrides?: Record<string, PatchLike>,
    recurrenceIdTimeZone?: TimeZoneId | null,
    includeAnchor = true,
): Generator<JSCalendarObject> {
    const hasZone = Boolean(recurrenceIdTimeZone);
    const utcMillisCache = new Map<string, number>();
    const strippedBase = stripRecurrenceProperties(base);
    const fromLocal =
        hasZone && recurrenceIdTimeZone
            ? dateTimeInTimeZone(range.from, recurrenceIdTimeZone)
            : localDateTimeFromDate(range.from);
    const toLocal =
        hasZone && recurrenceIdTimeZone
            ? dateTimeInTimeZone(range.to, recurrenceIdTimeZone)
            : localDateTimeFromDate(range.to);
    const fromDate = range.from;
    const toDate = range.to;

    const overrideKeys = overrides ? Object.keys(overrides) : [];

    if (!rules || rules.length === 0) {
        if (includeAnchor) {
            if (hasZone && recurrenceIdTimeZone) {
                if (
                    isInRangeWithZone(
                        anchor,
                        fromDate,
                        toDate,
                        recurrenceIdTimeZone,
                    )
                ) {
                    yield base;
                }
            } else if (isInRange(anchor, fromLocal, toLocal)) {
                yield base;
            }
        }
        for (const key of overrideKeys) {
            const patch = overrides ? overrides[key] : undefined;
            const instance = buildInstance(
                base,
                strippedBase,
                key,
                recurrenceIdTimeZone,
                patch,
            );
            if (!instance) continue;
            if (hasZone && recurrenceIdTimeZone) {
                if (
                    isInRangeWithZone(
                        key,
                        fromDate,
                        toDate,
                        recurrenceIdTimeZone,
                    )
                ) {
                    yield instance;
                }
            } else if (isInRange(key, fromLocal, toLocal)) {
                yield instance;
            }
        }
        return;
    }

    const occurrences = new Set<string>();
    for (const rule of rules) {
        const expanded = expandRule(
            anchor,
            rule,
            fromLocal,
            toLocal,
            true,
            recurrenceIdTimeZone ?? undefined,
            fromDate,
            toDate,
        );
        for (const value of expanded) {
            occurrences.add(value);
        }
    }

    const excluded = new Set<string>();
    if (excludedRules && excludedRules.length > 0) {
        for (const rule of excludedRules) {
            const expanded = expandRule(
                anchor,
                rule,
                fromLocal,
                toLocal,
                true,
                recurrenceIdTimeZone ?? undefined,
                fromDate,
                toDate,
            );
            for (const value of expanded) {
                excluded.add(value);
            }
        }
    }

    if (includeAnchor) {
        occurrences.add(anchor);
    }
    for (const key of overrideKeys) {
        occurrences.add(key);
    }

    let sorted = Array.from(occurrences).sort((a, b) =>
        compareLocal(a, b, recurrenceIdTimeZone ?? undefined, utcMillisCache),
    );
    if (rules[0]?.count && sorted.length > rules[0].count) {
        sorted = sorted.slice(0, rules[0].count);
    }

    for (const dt of sorted) {
        if (!includeAnchor && dt === anchor) continue;
        if (excluded.has(dt)) continue;
        const patch = overrides ? overrides[dt] : undefined;
        const instance = buildInstance(
            base,
            strippedBase,
            dt,
            recurrenceIdTimeZone,
            patch,
        );
        if (!instance) continue;
        if (hasZone && recurrenceIdTimeZone) {
            if (
                isInRangeWithZone(
                    dt,
                    fromDate,
                    toDate,
                    recurrenceIdTimeZone,
                    utcMillisCache,
                )
            ) {
                yield instance;
            }
        } else if (isInRange(dt, fromLocal, toLocal)) {
            yield instance;
        }
    }
}

/**
 * Build an occurrence instance from a base object plus override patch.
 * @param base Base JSCalendar object.
 * @param recurrenceId LocalDateTime recurrence id.
 * @param recurrenceIdTimeZone Optional time zone for recurrence id.
 * @param patch Override patch for the occurrence.
 * @return Occurrence instance or null if excluded.
 */
function buildInstance(
    base: JSCalendarObject,
    strippedBase: JSCalendarObject,
    recurrenceId: string,
    recurrenceIdTimeZone: TimeZoneId | null | undefined,
    patch?: PatchLike,
): JSCalendarObject | null {
    if (!patch) {
        return buildUnpatchedInstance(
            strippedBase,
            recurrenceId,
            recurrenceIdTimeZone,
        );
    }

    const patched = applyPatch(base, patch);
    if (isExcludedInstance(patched)) {
        return null;
    }

    const overridesStart = patchHasKey(patch, "start");
    const overridesDue = patchHasKey(patch, "due");

    let shifted: JSCalendarObject;
    if (patched["@type"] === TYPE_EVENT) {
        shifted = overridesStart
            ? patched
            : { ...patched, start: recurrenceId };
    } else if (patched["@type"] === TYPE_TASK) {
        if (patched.start) {
            shifted = overridesStart
                ? patched
                : { ...patched, start: recurrenceId };
        } else if (patched.due) {
            shifted = overridesDue
                ? patched
                : { ...patched, due: recurrenceId };
        } else {
            shifted = patched;
        }
    } else {
        shifted = patched;
    }

    const instance = withRecurrenceId(
        stripRecurrenceProperties(shifted),
        recurrenceId,
        recurrenceIdTimeZone,
    );

    return instance;
}

/**
 * Build an occurrence instance when no override patch is present.
 * @param strippedBase Base object without recurrence metadata.
 * @param recurrenceId LocalDateTime recurrence id.
 * @param recurrenceIdTimeZone Optional time zone for recurrence id.
 * @return Occurrence instance.
 */
function buildUnpatchedInstance(
    strippedBase: JSCalendarObject,
    recurrenceId: string,
    recurrenceIdTimeZone: TimeZoneId | null | undefined,
): JSCalendarObject {
    if (strippedBase["@type"] === TYPE_EVENT) {
        return withRecurrenceId(
            { ...strippedBase, start: recurrenceId },
            recurrenceId,
            recurrenceIdTimeZone,
        );
    }
    if (strippedBase["@type"] === TYPE_TASK) {
        if (strippedBase.start) {
            return withRecurrenceId(
                { ...strippedBase, start: recurrenceId },
                recurrenceId,
                recurrenceIdTimeZone,
            );
        }
        if (strippedBase.due) {
            return withRecurrenceId(
                { ...strippedBase, due: recurrenceId },
                recurrenceId,
                recurrenceIdTimeZone,
            );
        }
    }

    return withRecurrenceId(
        { ...strippedBase },
        recurrenceId,
        recurrenceIdTimeZone,
    );
}

/**
 * Attach recurrence metadata to an occurrence instance.
 * @param value Base occurrence value.
 * @param recurrenceId LocalDateTime recurrence id.
 * @param recurrenceIdTimeZone Optional recurrence id time zone.
 * @return Occurrence with recurrence metadata.
 */
function withRecurrenceId(
    value: JSCalendarObject,
    recurrenceId: string,
    recurrenceIdTimeZone: TimeZoneId | null | undefined,
): JSCalendarObject {
    const instance: JSCalendarObject = {
        ...value,
        recurrenceId,
    };

    if (recurrenceIdTimeZone) {
        instance.recurrenceIdTimeZone = recurrenceIdTimeZone;
    }

    return instance;
}

/**
 * Check if a patch contains a key or pointer.
 * @param patch Patch object to inspect.
 * @param key Field name to look up.
 * @return True when the patch modifies the field.
 */
function patchHasKey(patch: PatchLike | undefined, key: string): boolean {
    if (!patch) return false;
    if (Object.prototype.hasOwnProperty.call(patch, key)) return true;
    if (Object.prototype.hasOwnProperty.call(patch, `/${key}`)) return true;
    return false;
}

/**
 * Strip recurrence properties from value.
 * @param object JSCalendar object to clean.
 * @return Object without recurrence rule fields.
 */
function stripRecurrenceProperties(object: JSCalendarObject): JSCalendarObject {
    const {
        recurrenceRules: _recurrenceRules,
        excludedRecurrenceRules: _excludedRecurrenceRules,
        recurrenceOverrides: _recurrenceOverrides,
        ...rest
    } = object;
    return rest;
}

/**
 * Check whether value is excluded instance.
 * @param object JSCalendar object.
 * @return True when the occurrence is excluded.
 */
function isExcludedInstance(object: JSCalendarObject): boolean {
    return object.excluded === true;
}

/**
 * Check whether value is in range.
 * @param value LocalDateTime string.
 * @param from LocalDateTime lower bound.
 * @param to LocalDateTime upper bound.
 * @return True when value is within the range.
 */
function isInRange(value: string, from: string, to: string): boolean {
    return value >= from && value <= to;
}

/**
 * Check whether value is in range with zone.
 * @param value LocalDateTime string.
 * @param from Date lower bound.
 * @param to Date upper bound.
 * @param timeZone Time zone for LocalDateTime conversion.
 * @return True when value is within the range.
 */
function isInRangeWithZone(
    value: string,
    from: Date,
    to: Date,
    timeZone: TimeZoneId,
    utcMillisCache?: Map<string, number>,
): boolean {
    const utc = getUtcMillis(value, timeZone, utcMillisCache);
    return utc >= from.getTime() && utc <= to.getTime();
}

/**
 * Compare local date-time strings, optionally using a time zone.
 * @param a LocalDateTime string A.
 * @param b LocalDateTime string B.
 * @param timeZone Optional time zone for comparison.
 * @return Negative/zero/positive comparison result.
 */
function compareLocal(
    a: string,
    b: string,
    timeZone?: TimeZoneId,
    utcMillisCache?: Map<string, number>,
): number {
    if (!timeZone) {
        if (a === b) return 0;
        return a < b ? -1 : 1;
    }
    const aUtc = getUtcMillis(a, timeZone, utcMillisCache);
    const bUtc = getUtcMillis(b, timeZone, utcMillisCache);
    if (aUtc === bUtc) return 0;
    return aUtc < bUtc ? -1 : 1;
}

/**
 * Convert a local date-time to UTC milliseconds with optional memoization.
 * @param value Local date-time string.
 * @param timeZone Time zone for conversion.
 * @param utcMillisCache Optional UTC millisecond cache.
 * @return UTC milliseconds for the value in the time zone.
 */
function getUtcMillis(
    value: string,
    timeZone: TimeZoneId,
    utcMillisCache?: Map<string, number>,
): number {
    const key = `${timeZone}:${value}`;
    const cached = utcMillisCache?.get(key);
    if (cached !== undefined) {
        return cached;
    }
    const utc = localDateTimeToUtcDate(value, timeZone).getTime();
    utcMillisCache?.set(key, utc);
    return utc;
}
