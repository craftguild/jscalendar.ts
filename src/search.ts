import type { Event, Group, JSCalendarObject, Task } from "./types.js";
import {
  compareDateTime,
  dateTimeInTimeZone,
  durationToMilliseconds,
  isStringValue,
  isUtcDateTime,
  localDateTimeFromDate,
  localDateTimeToUtcDate,
} from "./utils.js";

const TYPE_EVENT = "Event";
const TYPE_GROUP = "Group";
const TYPE_TASK = "Task";

export type DateRangeValue = string | Date;

export type DateRange = {
  start?: DateRangeValue;
  end?: DateRangeValue;
};

export type DateRangeOptions = {
  includeIncomparable?: boolean;
};

/**
 * Find a JSCalendar object by UID.
 * @param items Items to search.
 * @param uid UID to match.
 * @return The matching item or undefined.
 */
export function findByUid<T extends JSCalendarObject>(items: T[], uid: string): T | undefined {
  return items.find((item) => item.uid === uid);
}

/**
 * Filter items by JSCalendar @type.
 * @param items Items to filter.
 * @param type Type to match.
 * @return Filtered items.
 */
export function filterByType<T extends JSCalendarObject>(items: T[], type: T["@type"]): T[] {
  return items.filter((item) => item["@type"] === type);
}

/**
 * Group JSCalendar objects by @type.
 * @param items Items to group.
 * @return Record keyed by type.
 */
export function groupByType(items: JSCalendarObject[]): Record<string, JSCalendarObject[]> {
  return items.reduce<Record<string, JSCalendarObject[]>>((acc, item) => {
    const type = item["@type"];
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {});
}

/**
 * Filter items by free-text match.
 * @param items Items to search.
 * @param query Text query.
 * @return Filtered items.
 */
export function filterByText(items: JSCalendarObject[], query: string): JSCalendarObject[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((item) => collectText(item).includes(needle));
}

/**
 * Filter items that intersect a date range.
 * @param items Items to filter.
 * @param range Range with optional start and end.
 * @param options Filtering options.
 * @return Filtered items.
 */
export function filterByDateRange(
  items: JSCalendarObject[],
  range: DateRange,
  options: DateRangeOptions = {},
): JSCalendarObject[] {
  const includeIncomparable = options.includeIncomparable ?? false;
  return items.filter((item) => {
    const objectRange = getObjectRange(item);
    if (!objectRange) return includeIncomparable;

    const hasDateRange = range.start instanceof Date || range.end instanceof Date;
    if (hasDateRange) {
      const objectRangeDate = getObjectRangeAsDates(item);
      if (!objectRangeDate) return includeIncomparable;
      const startDate = objectRangeDate.start;
      const endDate = objectRangeDate.end ?? objectRangeDate.start;
      if (range.start instanceof Date) {
        if (endDate < range.start) return false;
      }
      if (range.end instanceof Date) {
        if (startDate > range.end) return false;
      }
      return true;
    }

    const timeZone = "timeZone" in item ? item.timeZone ?? undefined : undefined;
    const rangeStart = normalizeRangeValue(range.start, timeZone);
    const rangeEnd = normalizeRangeValue(range.end, timeZone);

    if (range.start) {
      const cmpStart = compareDateTime(objectRange.end ?? objectRange.start, rangeStart);
      if (cmpStart === null) return includeIncomparable;
      if (cmpStart < 0) return false;
    }
    if (range.end) {
      const cmpEnd = compareDateTime(objectRange.start, rangeEnd);
      if (cmpEnd === null) return includeIncomparable;
      if (cmpEnd > 0) return false;
    }
    return true;
  });
}

/**
 * Normalize a range value into a LocalDateTime or UTCDateTime string.
 * @param value Range value.
 * @param timeZone Optional time zone.
 * @return Normalized date-time string.
 */
function normalizeRangeValue(value: DateRangeValue | undefined, timeZone?: string): string {
  if (!value) return "";
  if (isStringValue(value)) return value;
  if (timeZone) {
    return dateTimeInTimeZone(value, timeZone);
  }
  return localDateTimeFromDate(value);
}

/**
 * Collect searchable text from a JSCalendar object.
 * @param item Item to inspect.
 * @return Lowercased text blob.
 */
function collectText(item: JSCalendarObject): string {
  const parts: string[] = [];
  if (item.title) parts.push(item.title);
  if (item.description) parts.push(item.description);

  if (item.locations) {
    for (const location of Object.values(item.locations)) {
      if (location.name) parts.push(location.name);
      if (location.description) parts.push(location.description);
    }
  }

  if (item.virtualLocations) {
    for (const vloc of Object.values(item.virtualLocations)) {
      if (vloc.name) parts.push(vloc.name);
      if (vloc.description) parts.push(vloc.description);
      if (vloc.uri) parts.push(vloc.uri);
    }
  }

  if (item.participants) {
    for (const participant of Object.values(item.participants)) {
      if (participant.name) parts.push(participant.name);
      if (participant.email) parts.push(participant.email);
      if (participant.description) parts.push(participant.description);
    }
  }

  return parts.join(" ").toLowerCase();
}

/**
 * Get the string-based time range for an object.
 * @param item JSCalendar object.
 * @return Range or null if unavailable.
 */
function getObjectRange(item: JSCalendarObject): { start: string; end?: string } | null {
  if (item["@type"] === TYPE_EVENT) {
    return getEventRange(item);
  }
  if (item["@type"] === TYPE_TASK) {
    return getTaskRange(item);
  }
  if (item["@type"] === TYPE_GROUP) {
    return getGroupRange(item);
  }
  return null;
}

/**
 * Get the Date-based time range for an object.
 * @param item JSCalendar object.
 * @return Range or null if unavailable.
 */
function getObjectRangeAsDates(item: JSCalendarObject): { start: Date; end?: Date } | null {
  if (item["@type"] === TYPE_EVENT) {
    return getEventRangeAsDates(item);
  }
  if (item["@type"] === TYPE_TASK) {
    return getTaskRangeAsDates(item);
  }
  if (item["@type"] === TYPE_GROUP) {
    return getGroupRangeAsDates(item);
  }
  return null;
}

/**
 * Get the string-based range for an event.
 * @param event Event instance.
 * @return Event range.
 */
function getEventRange(event: Event): { start: string; end?: string } {
  if (!event.duration) return { start: event.start };
  if (isUtcDateTime(event.start)) {
    const ms = durationToMilliseconds(event.duration);
    if (ms !== null) {
      const end = new Date(Date.parse(event.start) + ms).toISOString().replace(/\.000Z$/, "Z");
      return { start: event.start, end };
    }
  }
  return { start: event.start };
}

/**
 * Get the Date-based range for an event.
 * @param event Event instance.
 * @return Event range or null if incomparable.
 */
function getEventRangeAsDates(event: Event): { start: Date; end?: Date } | null {
  const start = event.timeZone
    ? localDateTimeToUtcDate(event.start, event.timeZone)
    : isUtcDateTime(event.start)
      ? new Date(event.start)
      : null;
  if (!start) return null;
  if (!event.duration) return { start };
  const ms = durationToMilliseconds(event.duration);
  if (ms === null) return { start };
  return { start, end: new Date(start.getTime() + ms) };
}

/**
 * Get the string-based range for a task.
 * @param task Task instance.
 * @return Task range or null if missing.
 */
function getTaskRange(task: Task): { start: string; end?: string } | null {
  const start = task.start ?? task.due;
  if (!start) return null;
  return { start };
}

/**
 * Get the Date-based range for a task.
 * @param task Task instance.
 * @return Task range or null if incomparable.
 */
function getTaskRangeAsDates(task: Task): { start: Date; end?: Date } | null {
  const start = task.start ?? task.due;
  if (!start) return null;
  if (task.timeZone) {
    return { start: localDateTimeToUtcDate(start, task.timeZone) };
  }
  if (isUtcDateTime(start)) {
    return { start: new Date(start) };
  }
  return null;
}

/**
 * Get the string-based range for a group.
 * @param group Group instance.
 * @return Group range or null if empty.
 */
function getGroupRange(group: Group): { start: string; end?: string } | null {
  const ranges = group.entries
    .map((entry) => getObjectRange(entry))
    .filter((range): range is { start: string; end?: string } => Boolean(range));
  if (ranges.length === 0) return null;
  const starts = ranges.map((range) => range.start).sort();
  const ends = ranges.map((range) => range.end ?? range.start).sort();
  const start = starts[0];
  const end = ends[ends.length - 1];
  if (!start || !end) return null;
  return { start, end };
}

/**
 * Get the Date-based range for a group.
 * @param group Group instance.
 * @return Group range or null if empty.
 */
function getGroupRangeAsDates(group: Group): { start: Date; end?: Date } | null {
  const ranges = group.entries
    .map((entry) => getObjectRangeAsDates(entry))
    .filter((range): range is { start: Date; end?: Date } => Boolean(range));
  if (ranges.length === 0) return null;
  const starts = ranges.map((range) => range.start.getTime()).sort((a, b) => a - b);
  const ends = ranges.map((range) => (range.end ?? range.start).getTime()).sort((a, b) => a - b);
  const start = starts[0];
  const end = ends[ends.length - 1];
  if (start === undefined || end === undefined) return null;
  return { start: new Date(start), end: new Date(end) };
}
