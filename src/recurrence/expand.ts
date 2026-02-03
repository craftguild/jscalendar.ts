import type { Event, JSCalendarObject, PatchLike, RecurrenceRule, Task, TimeZoneId } from "../types.js";
import { applyPatch } from "../patch.js";
import { dateTimeInTimeZone, localDateTimeFromDate, localDateTimeToUtcDate } from "../utils.js";
import { TYPE_EVENT, TYPE_TASK } from "./constants.js";
import type { RecurrenceRange } from "./types.js";
import { expandRule } from "./rules.js";

/**
 * Expand recurrence into occurrences sorted by recurrenceId/start.
 * @param items JSCalendar objects to expand.
 * @param range Date range bounds.
 * @return Generator of expanded occurrences.
 */
export function* expandRecurrence(
  items: JSCalendarObject[],
  range: RecurrenceRange,
): Generator<JSCalendarObject> {
  const occurrences: Array<{ value: JSCalendarObject; key?: string; index: number }> = [];
  let index = 0;

  for (const item of items) {
    if (item["@type"] === TYPE_EVENT) {
      for (const occurrence of expandEvent(item, range)) {
        occurrences.push({ value: occurrence, key: occurrenceKey(occurrence), index });
        index += 1;
      }
      continue;
    }
    if (item["@type"] === TYPE_TASK) {
      for (const occurrence of expandTask(item, range)) {
        occurrences.push({ value: occurrence, key: occurrenceKey(occurrence), index });
        index += 1;
      }
      continue;
    }
    occurrences.push({ value: item, key: occurrenceKey(item), index });
    index += 1;
  }

  occurrences.sort((a, b) => {
    if (a.key && b.key) return a.key.localeCompare(b.key);
    if (a.key) return -1;
    if (b.key) return 1;
    return a.index - b.index;
  });

  for (const occurrence of occurrences) {
    yield occurrence.value;
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
  options: { limit: number; cursor?: string },
): { items: JSCalendarObject[]; nextCursor?: string } {
  const result: JSCalendarObject[] = [];
  let nextCursor: string | undefined;

  for (const occurrence of expandRecurrence(items, range)) {
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
 * @return Generator of expanded occurrences.
 */
function expandEvent(event: Event, range: RecurrenceRange): Generator<JSCalendarObject> {
  return expandObject(
    event,
    range,
    event.start,
    event.recurrenceRules,
    event.excludedRecurrenceRules,
    event.recurrenceOverrides,
    event.timeZone ?? null,
  );
}

/**
 * Expand task into occurrences.
 * @param task Task to expand.
 * @param range Date range bounds.
 * @return Generator of expanded occurrences.
 */
function expandTask(task: Task, range: RecurrenceRange): Generator<JSCalendarObject> {
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

/**
 * Expand object into occurrences.
 * @param base Base JSCalendar object.
 * @param range Date range bounds.
 * @param anchor Anchor LocalDateTime for the series.
 * @param rules Inclusion recurrence rules.
 * @param excludedRules Exclusion recurrence rules.
 * @param overrides Recurrence overrides keyed by LocalDateTime.
 * @param recurrenceIdTimeZone Optional time zone for recurrence IDs.
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
): Generator<JSCalendarObject> {
  const hasZone = Boolean(recurrenceIdTimeZone);
  const fromLocal = hasZone && recurrenceIdTimeZone
    ? dateTimeInTimeZone(range.from, recurrenceIdTimeZone)
    : localDateTimeFromDate(range.from);
  const toLocal = hasZone && recurrenceIdTimeZone
    ? dateTimeInTimeZone(range.to, recurrenceIdTimeZone)
    : localDateTimeFromDate(range.to);
  const fromDate = range.from;
  const toDate = range.to;

  const overrideKeys = overrides ? Object.keys(overrides) : [];

  if (!rules || rules.length === 0) {
    if (hasZone && recurrenceIdTimeZone) {
      if (isInRangeWithZone(anchor, fromDate, toDate, recurrenceIdTimeZone)) {
        yield base;
      }
    } else if (isInRange(anchor, fromLocal, toLocal)) {
      yield base;
    }
    for (const key of overrideKeys) {
      const patch = overrides ? overrides[key] : undefined;
      const instance = buildInstance(base, key, recurrenceIdTimeZone, patch);
      if (!instance) continue;
      if (hasZone && recurrenceIdTimeZone) {
        if (isInRangeWithZone(key, fromDate, toDate, recurrenceIdTimeZone)) {
          yield instance;
        }
      } else if (isInRange(key, fromLocal, toLocal)) {
        yield instance;
      }
    }
    return;
  }

  const occurrences: string[] = [];
  for (const rule of rules) {
    const expanded = expandRule(anchor, rule, fromLocal, toLocal, true, recurrenceIdTimeZone ?? undefined, fromDate, toDate);
    occurrences.push(...expanded);
  }

  const excluded = new Set<string>();
  if (excludedRules && excludedRules.length > 0) {
    for (const rule of excludedRules) {
      const expanded = expandRule(anchor, rule, fromLocal, toLocal, true, recurrenceIdTimeZone ?? undefined, fromDate, toDate);
      for (const value of expanded) {
        excluded.add(value);
      }
    }
  }

  if (!occurrences.includes(anchor)) {
    occurrences.push(anchor);
  }
  for (const key of overrideKeys) {
    if (!occurrences.includes(key)) {
      occurrences.push(key);
    }
  }

  let sorted = Array.from(new Set(occurrences)).sort((a, b) => compareLocal(a, b, recurrenceIdTimeZone ?? undefined));
  if (rules[0]?.count && sorted.length > rules[0].count) {
    sorted = sorted.slice(0, rules[0].count);
  }

  for (const dt of sorted) {
    if (excluded.has(dt)) continue;
    const patch = overrides ? overrides[dt] : undefined;
    const instance = buildInstance(base, dt, recurrenceIdTimeZone, patch);
    if (!instance) continue;
    if (hasZone && recurrenceIdTimeZone) {
      if (isInRangeWithZone(dt, fromDate, toDate, recurrenceIdTimeZone)) {
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
  recurrenceId: string,
  recurrenceIdTimeZone: TimeZoneId | null | undefined,
  patch?: PatchLike,
): JSCalendarObject | null {
  const patched = patch ? applyPatch(base, patch) : base;
  if (isExcludedInstance(patched)) {
    return null;
  }

  const overridesStart = patchHasKey(patch, "start");
  const overridesDue = patchHasKey(patch, "due");

  let shifted: JSCalendarObject;
  if (patched["@type"] === TYPE_EVENT) {
    shifted = overridesStart ? patched : { ...patched, start: recurrenceId };
  } else if (patched["@type"] === TYPE_TASK) {
    if (patched.start) {
      shifted = overridesStart ? patched : { ...patched, start: recurrenceId };
    } else if (patched.due) {
      shifted = overridesDue ? patched : { ...patched, due: recurrenceId };
    } else {
      shifted = patched;
    }
  } else {
    shifted = patched;
  }

  const instance: JSCalendarObject = {
    ...stripRecurrenceProperties(shifted),
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
function isInRangeWithZone(value: string, from: Date, to: Date, timeZone: TimeZoneId): boolean {
  const utc = localDateTimeToUtcDate(value, timeZone);
  return utc >= from && utc <= to;
}

/**
 * Compare local date-time strings, optionally using a time zone.
 * @param a LocalDateTime string A.
 * @param b LocalDateTime string B.
 * @param timeZone Optional time zone for comparison.
 * @return Negative/zero/positive comparison result.
 */
function compareLocal(a: string, b: string, timeZone?: TimeZoneId): number {
  if (!timeZone) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }
  const aUtc = localDateTimeToUtcDate(a, timeZone).getTime();
  const bUtc = localDateTimeToUtcDate(b, timeZone).getTime();
  if (aUtc === bUtc) return 0;
  return aUtc < bUtc ? -1 : 1;
}
