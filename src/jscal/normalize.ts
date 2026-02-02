import type { Event, JSCalendarObject, Task } from "../types.js";
import type { EntryInput } from "./types.js";
import { isObjectValue } from "../utils.js";

/**
 * Type guard for wrapper instances that expose a data field.
 * @param value Value to check.
 * @return True when value looks like a JsCal instance.
 */
export function isJsCalInstance(value: object): value is { data: JSCalendarObject } {
  return "data" in value;
}

/**
 * Normalize a list of mixed JSCalendar objects and JsCal instances.
 * @param items Items to normalize.
 * @return Plain JSCalendar objects.
 */
export function normalizeItems(items: Array<JSCalendarObject | { data: JSCalendarObject }>): JSCalendarObject[] {
  const mapped: JSCalendarObject[] = [];
  for (const entry of items) {
    if (isObjectValue(entry) && isJsCalInstance(entry)) {
      mapped.push(entry.data);
    } else {
      mapped.push(entry);
    }
  }
  return mapped;
}

/**
 * Normalize a group entry into a plain Event or Task.
 * @param entry Group entry input.
 * @return Plain Event or Task object.
 */
export function normalizeEntry(entry: EntryInput): Event | Task {
  if (isObjectValue(entry) && isJsCalInstance(entry)) {
    return entry.data;
  }
  return entry;
}

/**
 * Normalize a list to plain JSCalendar objects.
 * @param value List of JSCalendar objects or JsCal instances.
 * @return Plain JSCalendar objects.
 */
export function normalizeToObjects(
  value: Array<JSCalendarObject | { data: JSCalendarObject }>,
): JSCalendarObject[] {
  return normalizeItems(value);
}
