import type { Event, Group, JSCalendarObject, RecurrenceRule, Task } from "./types.js";
import { normalizeUtcDateTime } from "./utils.js";

export type ICalOptions = {
  prodId?: string;
  method?: string;
  includeXJSCalendar?: boolean;
};

const TYPE_EVENT = "Event";
const TYPE_GROUP = "Group";
const TYPE_TASK = "Task";
const DEFAULT_PRODID = "-//craftguild//EN";

/**
 * Convert JSCalendar objects into an iCalendar string.
 * @param objects JSCalendar objects to export.
 * @param options Export options.
 * @return iCalendar text.
 */
export function toICal(objects: JSCalendarObject[], options: ICalOptions = {}): string {
  const lines: string[] = [];
  const includeX = options.includeXJSCalendar !== false;

  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push(`PRODID:${options.prodId ?? DEFAULT_PRODID}`);

  const method = options.method ?? findMethod(objects);
  if (method) lines.push(`METHOD:${method.toUpperCase()}`);

  for (const object of objects) {
    if (object["@type"] === TYPE_GROUP) {
      const group = object;
      if (includeX) {
        lines.push(`X-JSCALENDAR-GROUP:${escapeText(JSON.stringify(stripEntries(group)))}`);
      }
      for (const entry of group.entries) {
        lines.push(...buildComponent(entry, includeX));
      }
    } else {
      lines.push(...buildComponent(object, includeX));
    }
  }

  lines.push("END:VCALENDAR");
  return foldLines(lines).join("\r\n");
}

/**
 * Find the first METHOD value from objects.
 * @param objects JSCalendar objects.
 * @return METHOD value or undefined.
 */
function findMethod(objects: JSCalendarObject[]): string | undefined {
  for (const object of objects) {
    if (object.method) return object.method;
  }
  return undefined;
}

/**
 * Build an iCalendar component from a JSCalendar object.
 * @param object JSCalendar object.
 * @param includeX Whether to include X-JSCALENDAR.
 * @return iCalendar lines for the component.
 */
function buildComponent(object: JSCalendarObject, includeX: boolean): string[] {
  if (object["@type"] === TYPE_EVENT) return buildEvent(object, includeX);
  if (object["@type"] === TYPE_TASK) return buildTask(object, includeX);
  return [];
}

/**
 * Build a VEVENT component.
 * @param event Event object.
 * @param includeX Whether to include X-JSCALENDAR.
 * @return VEVENT lines.
 */
function buildEvent(event: Event, includeX: boolean): string[] {
  const lines: string[] = [];
  lines.push("BEGIN:VEVENT");
  lines.push(`UID:${escapeText(event.uid)}`);
  lines.push(`DTSTAMP:${formatUtcDateTime(event.updated)}`);
  if (event.sequence !== undefined) lines.push(`SEQUENCE:${event.sequence}`);
  if (event.title) lines.push(`SUMMARY:${escapeText(event.title)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);

  const dtStart = formatLocalDateTime(event.start);
  if (event.timeZone) {
    lines.push(`DTSTART;TZID=${event.timeZone}:${dtStart}`);
  } else {
    lines.push(`DTSTART:${dtStart}`);
  }

  if (event.duration) lines.push(`DURATION:${event.duration}`);
  if (event.status) lines.push(`STATUS:${event.status.toUpperCase()}`);

  appendRecurrence(lines, event.recurrenceRules);

  if (includeX) {
    lines.push(`X-JSCALENDAR:${escapeText(JSON.stringify(event))}`);
  }

  lines.push("END:VEVENT");
  return lines;
}

/**
 * Build a VTODO component.
 * @param task Task object.
 * @param includeX Whether to include X-JSCALENDAR.
 * @return VTODO lines.
 */
function buildTask(task: Task, includeX: boolean): string[] {
  const lines: string[] = [];
  lines.push("BEGIN:VTODO");
  lines.push(`UID:${escapeText(task.uid)}`);
  lines.push(`DTSTAMP:${formatUtcDateTime(task.updated)}`);
  if (task.sequence !== undefined) lines.push(`SEQUENCE:${task.sequence}`);
  if (task.title) lines.push(`SUMMARY:${escapeText(task.title)}`);
  if (task.description) lines.push(`DESCRIPTION:${escapeText(task.description)}`);

  if (task.start) {
    const dtStart = formatLocalDateTime(task.start);
    if (task.timeZone) {
      lines.push(`DTSTART;TZID=${task.timeZone}:${dtStart}`);
    } else {
      lines.push(`DTSTART:${dtStart}`);
    }
  }

  if (task.due) {
    const due = formatLocalDateTime(task.due);
    if (task.timeZone) {
      lines.push(`DUE;TZID=${task.timeZone}:${due}`);
    } else {
      lines.push(`DUE:${due}`);
    }
  }

  if (task.percentComplete !== undefined) {
    lines.push(`PERCENT-COMPLETE:${task.percentComplete}`);
  }

  if (task.progress) {
    lines.push(`STATUS:${task.progress.toUpperCase()}`);
  }

  appendRecurrence(lines, task.recurrenceRules);

  if (includeX) {
    lines.push(`X-JSCALENDAR:${escapeText(JSON.stringify(task))}`);
  }

  lines.push("END:VTODO");
  return lines;
}

/**
 * Append RRULE lines for recurrence rules.
 * @param lines Lines to append to.
 * @param rules Recurrence rules.
 * @return Nothing.
 */
function appendRecurrence(lines: string[], rules?: RecurrenceRule[]): void {
  if (!rules) return;
  for (const rule of rules) {
    const rrule = recurrenceRuleToRRule(rule);
    if (rrule) lines.push(`RRULE:${rrule}`);
  }
}

/**
 * Convert a RecurrenceRule to an RRULE string.
 * @param rule Recurrence rule.
 * @return RRULE value or null.
 */
function recurrenceRuleToRRule(rule: RecurrenceRule): string | null {
  const parts: string[] = [];
  parts.push(`FREQ=${rule.frequency.toUpperCase()}`);
  if (rule.interval) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.count) parts.push(`COUNT=${rule.count}`);
  if (rule.until) parts.push(`UNTIL=${formatLocalDateTime(rule.until)}`);
  if (rule.byDay?.length) {
    const days = rule.byDay
      .map((day) => `${day.nthOfPeriod ?? ""}${day.day.toUpperCase()}`)
      .join(",");
    parts.push(`BYDAY=${days}`);
  }
  if (rule.byMonthDay?.length) parts.push(`BYMONTHDAY=${rule.byMonthDay.join(",")}`);
  if (rule.byMonth?.length) parts.push(`BYMONTH=${rule.byMonth.join(",")}`);
  if (rule.byYearDay?.length) parts.push(`BYYEARDAY=${rule.byYearDay.join(",")}`);
  if (rule.byWeekNo?.length) parts.push(`BYWEEKNO=${rule.byWeekNo.join(",")}`);
  if (rule.byHour?.length) parts.push(`BYHOUR=${rule.byHour.join(",")}`);
  if (rule.byMinute?.length) parts.push(`BYMINUTE=${rule.byMinute.join(",")}`);
  if (rule.bySecond?.length) parts.push(`BYSECOND=${rule.bySecond.join(",")}`);
  if (rule.bySetPosition?.length) parts.push(`BYSETPOS=${rule.bySetPosition.join(",")}`);
  if (rule.firstDayOfWeek) parts.push(`WKST=${rule.firstDayOfWeek.toUpperCase()}`);
  if (rule.rscale) parts.push(`RSCALE=${rule.rscale.toUpperCase()}`);
  if (rule.skip) parts.push(`SKIP=${rule.skip.toUpperCase()}`);
  return parts.join(";");
}

/**
 * Format a UTCDateTime for iCalendar.
 * @param value UTCDateTime string.
 * @return iCalendar-formatted UTCDateTime.
 */
function formatUtcDateTime(value: string): string {
  const normalized = normalizeUtcDateTime(value);
  return normalized
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z")
    .replace(/Z$/, "Z");
}

/**
 * Format a LocalDateTime for iCalendar.
 * @param value LocalDateTime string.
 * @return iCalendar-formatted LocalDateTime.
 */
function formatLocalDateTime(value: string): string {
  return value
    .replace(/[-:]/g, "")
    .replace(/\.\d+$/, "")
    .replace(/Z$/, "");
}

/**
 * Escape text for iCalendar content lines.
 * @param value Raw text.
 * @return Escaped text.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/**
 * Fold iCalendar lines to 75 octets per RFC.
 * @param lines Lines to fold.
 * @return Folded lines.
 */
function foldLines(lines: string[]): string[] {
  const result: string[] = [];
  for (const line of lines) {
    if (line.length <= 75) {
      result.push(line);
      continue;
    }
    let remaining = line;
    result.push(remaining.slice(0, 75));
    remaining = remaining.slice(75);
    while (remaining.length > 0) {
      result.push(` ${remaining.slice(0, 74)}`);
      remaining = remaining.slice(74);
    }
  }
  return result;
}

/**
 * Strip group entries for X-JSCALENDAR-GROUP payload.
 * @param group Group object.
 * @return Group without entries.
 */
function stripEntries(group: Group): Omit<Group, "entries"> {
  const { entries: _entries, ...rest } = group;
  return rest;
}
