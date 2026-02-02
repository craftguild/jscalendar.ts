import type { Event, Group, JSCalendarObject, RecurrenceRule, Task } from "./types.js";
import { normalizeUtcDateTime } from "./utils.js";

export type ICalOptions = {
  prodId?: string;
  method?: string;
  includeXJSCalendar?: boolean;
};

const DEFAULT_PRODID = "-//craftguild//EN";

export function toICal(objects: JSCalendarObject[], options: ICalOptions = {}): string {
  const lines: string[] = [];
  const includeX = options.includeXJSCalendar !== false;

  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push(`PRODID:${options.prodId ?? DEFAULT_PRODID}`);

  const method = options.method ?? findMethod(objects);
  if (method) lines.push(`METHOD:${method.toUpperCase()}`);

  for (const object of objects) {
    if (object["@type"] === "Group") {
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

function findMethod(objects: JSCalendarObject[]): string | undefined {
  for (const object of objects) {
    if (object.method) return object.method;
  }
  return undefined;
}

function buildComponent(object: JSCalendarObject, includeX: boolean): string[] {
  if (object["@type"] === "Event") return buildEvent(object, includeX);
  if (object["@type"] === "Task") return buildTask(object, includeX);
  return [];
}

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

function appendRecurrence(lines: string[], rules?: RecurrenceRule[]): void {
  if (!rules) return;
  for (const rule of rules) {
    const rrule = recurrenceRuleToRRule(rule);
    if (rrule) lines.push(`RRULE:${rrule}`);
  }
}

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

function formatUtcDateTime(value: string): string {
  const normalized = normalizeUtcDateTime(value);
  return normalized
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z")
    .replace(/Z$/, "Z");
}

function formatLocalDateTime(value: string): string {
  return value
    .replace(/[-:]/g, "")
    .replace(/\.\d+$/, "")
    .replace(/Z$/, "");
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

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

function stripEntries(group: Group): Omit<Group, "entries"> {
  const { entries: _entries, ...rest } = group;
  return rest;
}
