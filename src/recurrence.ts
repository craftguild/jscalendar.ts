import type {
  Event,
  JSCalendarObject,
  PatchObject,
  RecurrenceRule,
  Task,
  TimeZoneId,
} from "./types.js";
import { applyPatch } from "./patch.js";
import { dateTimeInTimeZone, localDateTimeFromDate, localDateTimeToUtcDate } from "./utils.js";

export type RecurrenceRange = {
  from: Date;
  to: Date;
};

export type RecurrencePage = {
  items: JSCalendarObject[];
  nextCursor?: string;
};

export type RecurrencePageOptions = {
  limit: number;
  cursor?: string;
};

export function* expandRecurrence(
  items: JSCalendarObject[],
  range: RecurrenceRange,
): Generator<JSCalendarObject> {
  for (const item of items) {
    if (item["@type"] === "Event") {
      yield* expandEvent(item, range);
    } else if (item["@type"] === "Task") {
      yield* expandTask(item, range);
    } else {
      yield item;
    }
  }
}

export function expandRecurrencePaged(
  items: JSCalendarObject[],
  range: RecurrenceRange,
  options: RecurrencePageOptions,
): RecurrencePage {
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

function occurrenceKey(value: JSCalendarObject): string | undefined {
  if (value.recurrenceId) return value.recurrenceId;
  if (value["@type"] === "Event") return value.start;
  if (value["@type"] === "Task") return value.start ?? value.due;
  return undefined;
}

function* expandObject(
  base: JSCalendarObject,
  range: RecurrenceRange,
  anchor: string,
  rules?: RecurrenceRule[],
  excludedRules?: RecurrenceRule[],
  overrides?: Record<string, PatchObject>,
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
      if (hasZone && recurrenceIdTimeZone) {
        if (!isInRangeWithZone(key, fromDate, toDate, recurrenceIdTimeZone)) continue;
      } else if (!isInRange(key, fromLocal, toLocal)) {
        continue;
      }
      const patch = overrides ? overrides[key] : undefined;
      const instance = buildInstance(base, key, recurrenceIdTimeZone, patch);
      if (instance) {
        yield instance;
      }
    }
    return;
  }

  const occurrences = new Set<string>();
  for (const rule of rules) {
    for (const dt of expandRule(anchor, rule, fromLocal, toLocal, true, recurrenceIdTimeZone ?? undefined, fromDate, toDate)) {
      occurrences.add(dt);
    }
  }

  if (excludedRules) {
    for (const rule of excludedRules) {
      for (const dt of expandRule(anchor, rule, fromLocal, toLocal, false, recurrenceIdTimeZone ?? undefined, fromDate, toDate)) {
        occurrences.delete(dt);
      }
    }
  }

  for (const key of overrideKeys) {
    if (hasZone && recurrenceIdTimeZone) {
      if (isInRangeWithZone(key, fromDate, toDate, recurrenceIdTimeZone)) {
        occurrences.add(key);
      }
    } else if (isInRange(key, fromLocal, toLocal)) {
      occurrences.add(key);
    }
  }

  const sorted = Array.from(occurrences).sort();

  for (const dt of sorted) {
    const patch = overrides ? overrides[dt] : undefined;
    const instance = buildInstance(base, dt, recurrenceIdTimeZone, patch);
    if (instance) {
      yield instance;
    }
  }
}

function buildInstance(
  base: JSCalendarObject,
  recurrenceId: string,
  recurrenceIdTimeZone: TimeZoneId | null | undefined,
  patch?: PatchObject,
): JSCalendarObject | null {
  const patched = patch ? applyPatch(base, patch) : base;
  if (isExcludedInstance(patched)) {
    return null;
  }

  const overridesStart = patchHasKey(patch, "start");
  const overridesDue = patchHasKey(patch, "due");

  let shifted: JSCalendarObject;
  if (patched["@type"] === "Event") {
    shifted = overridesStart ? patched : { ...patched, start: recurrenceId };
  } else if (patched["@type"] === "Task") {
    if (patched.start) {
      shifted = overridesStart ? patched : { ...patched, start: recurrenceId };
    } else {
      shifted = overridesDue ? patched : { ...patched, due: recurrenceId };
    }
  } else {
    shifted = patched;
  }

  const withoutRecurrence = stripRecurrenceProperties(shifted);
  return {
    ...withoutRecurrence,
    recurrenceId,
    recurrenceIdTimeZone: recurrenceIdTimeZone ?? null,
  };
}

function patchHasKey(patch: PatchObject | undefined, key: string): boolean {
  if (!patch) return false;
  if (Object.prototype.hasOwnProperty.call(patch, key)) return true;
  if (Object.prototype.hasOwnProperty.call(patch, `/${key}`)) return true;
  return false;
}

function stripRecurrenceProperties(object: JSCalendarObject): JSCalendarObject {
  const {
    recurrenceRules: _recurrenceRules,
    excludedRecurrenceRules: _excludedRecurrenceRules,
    recurrenceOverrides: _recurrenceOverrides,
    ...rest
  } = object;
  return rest;
}

function isExcludedInstance(object: JSCalendarObject): boolean {
  return object.excluded === true;
}

function isInRange(value: string, from: string, to: string): boolean {
  return value >= from && value <= to;
}

function isInRangeWithZone(value: string, from: Date, to: Date, timeZone: TimeZoneId): boolean {
  const utc = localDateTimeToUtcDate(value, timeZone);
  return utc >= from && utc <= to;
}

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

function expandRule(
  anchor: string,
  rule: RecurrenceRule,
  fromLocal: string,
  toLocal: string,
  includeAnchor: boolean,
  timeZone?: TimeZoneId,
  fromDate?: Date,
  toDate?: Date,
): string[] {
  if (rule.rscale && rule.rscale !== "gregorian") {
    throw new Error(`Unsupported rscale: ${rule.rscale}`);
  }
  const start = parseLocalDateTime(anchor);
  const normalized = normalizeRule(rule, start);
  const interval = normalized.interval ?? 1;
  const until = normalized.until;
  const count = normalized.count;
  const bySetPos = normalized.bySetPosition ?? [];
  const skip = normalized.skip ?? "omit";
  const firstDay = normalized.firstDayOfWeek ?? "mo";

  const results: string[] = [];
  let generated = 0;
  const seen = skip === "omit" ? undefined : new Set<string>();

  if (includeAnchor) {
    generated += 1;
    if (timeZone && fromDate && toDate) {
      if (isInRangeWithZone(anchor, fromDate, toDate, timeZone)) {
        results.push(anchor);
      }
    } else if (isInRange(anchor, fromLocal, toLocal)) {
      results.push(anchor);
    }
    if (seen) seen.add(anchor);
    if (count && generated >= count) {
      return results;
    }
  }

  for (let step = 0; ; step += 1) {
    const periodStart = addInterval(start, normalized.frequency, interval * step, firstDay);
    const candidateTimes = generateDateTimes(periodStart, normalized, firstDay, skip);
    const ordered = candidateTimes.sort();
    const filtered = bySetPos.length > 0 ? applyBySetPos(ordered, bySetPos) : ordered;

    for (const dt of filtered) {
      if (until && compareLocal(dt, until, timeZone) > 0) {
        return results;
      }
      if (compareLocal(dt, anchor, timeZone) < 0) {
        continue;
      }
      if (includeAnchor && dt === anchor) {
        continue;
      }
      if (seen && seen.has(dt)) {
        continue;
      }
      if (seen) seen.add(dt);
      generated += 1;
      if (timeZone && fromDate && toDate) {
        if (isInRangeWithZone(dt, fromDate, toDate, timeZone)) {
          results.push(dt);
        }
      } else if (isInRange(dt, fromLocal, toLocal)) {
        results.push(dt);
      }
      if (count && generated >= count) {
        return results;
      }
    }

    const periodStartText = formatLocalDateTime(periodStart);
    if (compareLocal(periodStartText, toLocal, timeZone) > 0) {
      return results;
    }
  }
}

function normalizeRule(rule: RecurrenceRule, start: DateTime): RecurrenceRule {
  const normalized: RecurrenceRule = {
    ...rule,
    bySecond: rule.bySecond ? [...rule.bySecond] : undefined,
    byMinute: rule.byMinute ? [...rule.byMinute] : undefined,
    byHour: rule.byHour ? [...rule.byHour] : undefined,
    byDay: rule.byDay ? [...rule.byDay] : undefined,
    byMonthDay: rule.byMonthDay ? [...rule.byMonthDay] : undefined,
    byMonth: rule.byMonth ? [...rule.byMonth] : undefined,
    byYearDay: rule.byYearDay ? [...rule.byYearDay] : undefined,
    byWeekNo: rule.byWeekNo ? [...rule.byWeekNo] : undefined,
    bySetPosition: rule.bySetPosition ? [...rule.bySetPosition] : undefined,
  };

  if (normalized.frequency !== "secondly" && (!normalized.bySecond || normalized.bySecond.length === 0)) {
    normalized.bySecond = [start.second];
  }
  if (normalized.frequency !== "secondly" && normalized.frequency !== "minutely" &&
    (!normalized.byMinute || normalized.byMinute.length === 0)) {
    normalized.byMinute = [start.minute];
  }
  if (normalized.frequency !== "secondly" && normalized.frequency !== "minutely" && normalized.frequency !== "hourly" &&
    (!normalized.byHour || normalized.byHour.length === 0)) {
    normalized.byHour = [start.hour];
  }

  if (normalized.frequency === "weekly" && (!normalized.byDay || normalized.byDay.length === 0)) {
    normalized.byDay = [{ "@type": "NDay", day: dayOfWeek(start) }];
  }

  if (normalized.frequency === "monthly" && (!normalized.byDay || normalized.byDay.length === 0) &&
    (!normalized.byMonthDay || normalized.byMonthDay.length === 0)) {
    normalized.byMonthDay = [start.day];
  }

  if (normalized.frequency === "yearly" && (!normalized.byYearDay || normalized.byYearDay.length === 0)) {
    const hasByMonth = normalized.byMonth && normalized.byMonth.length > 0;
    const hasByWeekNo = normalized.byWeekNo && normalized.byWeekNo.length > 0;
    const hasByMonthDay = normalized.byMonthDay && normalized.byMonthDay.length > 0;
    const hasByDay = normalized.byDay && normalized.byDay.length > 0;

    if (!hasByMonth && !hasByWeekNo && (hasByMonthDay || !hasByDay)) {
      normalized.byMonth = [start.month.toString()];
    }

    if (!hasByMonthDay && !hasByWeekNo && !hasByDay) {
      normalized.byMonthDay = [start.day];
    }

    if (hasByWeekNo && !hasByMonthDay && !hasByDay) {
      normalized.byDay = [{ "@type": "NDay", day: dayOfWeek(start) }];
    }
  }

  return normalized;
}

function applyBySetPos(candidates: string[], setPos: number[]): string[] {
  const sorted = [...candidates].sort();
  const result: string[] = [];
  const total = sorted.length;
  for (const pos of setPos) {
    const index = pos > 0 ? pos - 1 : total + pos;
    if (index >= 0 && index < total) {
      const value = sorted[index];
      if (value !== undefined) {
        result.push(value);
      }
    }
  }
  return result;
}

type DateCandidate = {
  year: number;
  month: number;
  day: number;
  valid: boolean;
};

function generateDateTimes(
  periodStart: DateTime,
  rule: RecurrenceRule,
  firstDay: DayOfWeek,
  skip: string,
): string[] {
  const dateCandidates = generateDateCandidates(periodStart, rule, firstDay, skip);
  const filteredDates = filterDateCandidates(dateCandidates, rule, periodStart, firstDay, skip);

  const hours = rule.byHour && rule.byHour.length > 0 ? rule.byHour : [periodStart.hour];
  const minutes = rule.byMinute && rule.byMinute.length > 0 ? rule.byMinute : [periodStart.minute];
  const seconds = rule.bySecond && rule.bySecond.length > 0 ? rule.bySecond : [periodStart.second];

  const result: string[] = [];
  for (const date of filteredDates) {
    for (const hour of hours) {
      for (const minute of minutes) {
        for (const second of seconds) {
          const dt = formatLocalDateTime({
            year: date.year,
            month: date.month,
            day: date.day,
            hour,
            minute,
            second,
          });
          result.push(dt);
        }
      }
    }
  }

  return result;
}

function generateDateCandidates(
  periodStart: DateTime,
  rule: RecurrenceRule,
  firstDay: DayOfWeek,
  skip: string,
): DateCandidate[] {
  const result: DateCandidate[] = [];
  const wantsInvalid = skip !== "omit" && rule.byMonthDay && rule.byMonthDay.length > 0;

  if (rule.frequency === "yearly") {
    for (let month = 1; month <= 12; month += 1) {
      const maxDays = wantsInvalid ? 31 : daysInMonth(periodStart.year, month);
      for (let day = 1; day <= maxDays; day += 1) {
        const valid = day <= daysInMonth(periodStart.year, month);
        result.push({ year: periodStart.year, month, day, valid });
      }
    }
    return result;
  }

  if (rule.frequency === "monthly") {
    const maxDays = wantsInvalid ? 31 : daysInMonth(periodStart.year, periodStart.month);
    for (let day = 1; day <= maxDays; day += 1) {
      const valid = day <= daysInMonth(periodStart.year, periodStart.month);
      result.push({ year: periodStart.year, month: periodStart.month, day, valid });
    }
    return result;
  }

  if (rule.frequency === "weekly") {
    let cursor = periodStart;
    for (let i = 0; i < 7; i += 1) {
      result.push({ year: cursor.year, month: cursor.month, day: cursor.day, valid: true });
      cursor = addDays(cursor, 1);
    }
    return result;
  }

  if (rule.frequency === "daily") {
    result.push({ year: periodStart.year, month: periodStart.month, day: periodStart.day, valid: true });
    return result;
  }

  if (rule.frequency === "hourly" || rule.frequency === "minutely" || rule.frequency === "secondly") {
    result.push({ year: periodStart.year, month: periodStart.month, day: periodStart.day, valid: true });
    return result;
  }

  return result;
}

function filterDateCandidates(
  candidates: DateCandidate[],
  rule: RecurrenceRule,
  periodStart: DateTime,
  firstDay: DayOfWeek,
  skip: string,
): DateCandidate[] {
  let result = candidates;

  if (rule.byMonth && rule.byMonth.length > 0) {
    const months = rule.byMonth.map((m) => parseInt(m, 10)).filter((m) => !Number.isNaN(m));
    result = result.filter((d) => months.includes(d.month));
  }

  if (rule.byWeekNo && rule.byWeekNo.length > 0) {
    const byWeekNo = rule.byWeekNo;
    result = result.filter((d) => d.valid && matchesByWeekNo(d, byWeekNo, firstDay));
  }

  if (rule.byYearDay && rule.byYearDay.length > 0) {
    const byYearDay = rule.byYearDay;
    result = result.filter((d) => d.valid && matchesByYearDay(d, byYearDay));
  }

  if (rule.byMonthDay && rule.byMonthDay.length > 0) {
    const byMonthDay = rule.byMonthDay;
    result = result.filter((d) => matchesByMonthDay(d, byMonthDay));
    if (skip !== "omit") {
      result = adjustInvalidMonthDays(result, skip);
    }
  }

  if (rule.byDay && rule.byDay.length > 0) {
    const byDay = rule.byDay;
    result = result.filter((d) => matchesByDay(d, byDay, rule.frequency, periodStart, firstDay));
  }

  return result;
}

function adjustInvalidMonthDays(candidates: DateCandidate[], skip: string): DateCandidate[] {
  const adjusted: DateCandidate[] = [];
  for (const candidate of candidates) {
    if (candidate.valid) {
      adjusted.push(candidate);
      continue;
    }
    if (skip === "forward") {
      const next = addMonths({ year: candidate.year, month: candidate.month, day: 1, hour: 0, minute: 0, second: 0 }, 1);
      adjusted.push({ year: next.year, month: next.month, day: 1, valid: true });
    } else if (skip === "backward") {
      const day = daysInMonth(candidate.year, candidate.month);
      adjusted.push({ year: candidate.year, month: candidate.month, day, valid: true });
    }
  }

  const deduped = new Map<string, DateCandidate>();
  for (const candidate of adjusted) {
    const key = `${pad(candidate.year, 4)}-${pad(candidate.month, 2)}-${pad(candidate.day, 2)}`;
    if (!deduped.has(key)) {
      deduped.set(key, candidate);
    }
  }
  return Array.from(deduped.values());
}

function matchesByMonthDay(date: DateCandidate, byMonthDay: number[]): boolean {
  const dim = daysInMonth(date.year, date.month);
  for (const v of byMonthDay) {
    if (v > 0 && date.day === v) return true;
    if (v < 0 && date.day === dim + v + 1) return true;
  }
  return false;
}

function matchesByYearDay(date: DateCandidate, byYearDay: number[]): boolean {
  const diy = daysInYear(date.year);
  const doy = dayOfYear({ year: date.year, month: date.month, day: date.day, hour: 0, minute: 0, second: 0 });
  for (const v of byYearDay) {
    if (v > 0 && doy === v) return true;
    if (v < 0 && doy === diy + v + 1) return true;
  }
  return false;
}

function matchesByWeekNo(date: DateCandidate, byWeekNo: number[], firstDay: DayOfWeek): boolean {
  const week = weekNumber(
    { year: date.year, month: date.month, day: date.day, hour: 0, minute: 0, second: 0 },
    firstDay,
  );
  const total = totalWeeksInYear(date.year, firstDay);
  for (const v of byWeekNo) {
    if (v > 0 && week === v) return true;
    if (v < 0 && week === total + v + 1) return true;
  }
  return false;
}

function matchesByDay(
  date: DateCandidate,
  byDay: { day: DayOfWeek; nthOfPeriod?: number }[],
  frequency: RecurrenceRule["frequency"],
  periodStart: DateTime,
  firstDay: DayOfWeek,
): boolean {
  const weekday = dayOfWeek({ year: date.year, month: date.month, day: date.day, hour: 0, minute: 0, second: 0 });
  for (const entry of byDay) {
    if (entry.nthOfPeriod === undefined) {
      if (entry.day === weekday) return true;
      continue;
    }
    if (frequency !== "monthly" && frequency !== "yearly") {
      continue;
    }
    const matches = listNthPeriodDates(date, frequency, periodStart, firstDay)
      .filter((d) => dayOfWeek(d) === entry.day);
    const index = entry.nthOfPeriod > 0 ? entry.nthOfPeriod - 1 : matches.length + entry.nthOfPeriod;
    if (index >= 0 && index < matches.length) {
      const target = matches[index];
      if (target && target.year === date.year && target.month === date.month && target.day === date.day) {
        return true;
      }
    }
  }
  return false;
}

function listNthPeriodDates(
  date: DateCandidate,
  frequency: RecurrenceRule["frequency"],
  periodStart: DateTime,
  firstDay: DayOfWeek,
): DateTime[] {
  if (frequency === "yearly") {
    const result: DateTime[] = [];
    for (let month = 1; month <= 12; month += 1) {
      const days = daysInMonth(date.year, month);
      for (let day = 1; day <= days; day += 1) {
        result.push({ year: date.year, month, day, hour: 0, minute: 0, second: 0 });
      }
    }
    return result;
  }
  if (frequency === "monthly") {
    const result: DateTime[] = [];
    const days = daysInMonth(date.year, date.month);
    for (let day = 1; day <= days; day += 1) {
      result.push({ year: date.year, month: date.month, day, hour: 0, minute: 0, second: 0 });
    }
    return result;
  }

  const result: DateTime[] = [];
  let cursor = periodStart;
  for (let i = 0; i < 7; i += 1) {
    result.push({ year: cursor.year, month: cursor.month, day: cursor.day, hour: 0, minute: 0, second: 0 });
    cursor = addDays(cursor, 1);
  }
  return result;
}

function addInterval(start: DateTime, frequency: RecurrenceRule["frequency"], amount: number, firstDay: DayOfWeek): DateTime {
  if (frequency === "yearly") {
    return { year: start.year + amount, month: 1, day: 1, hour: 0, minute: 0, second: 0 };
  }
  if (frequency === "monthly") {
    const next = addMonths(start, amount);
    return { year: next.year, month: next.month, day: 1, hour: 0, minute: 0, second: 0 };
  }
  if (frequency === "weekly") {
    const weekStart = startOfWeek(start, firstDay);
    return addDays(weekStart, amount * 7);
  }
  if (frequency === "daily") {
    return addDays(start, amount);
  }
  if (frequency === "hourly") {
    return addHours(start, amount);
  }
  if (frequency === "minutely") {
    return addMinutes(start, amount);
  }
  return addSeconds(start, amount);
}

type DayOfWeek = "mo" | "tu" | "we" | "th" | "fr" | "sa" | "su";

type DateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function parseLocalDateTime(value: string): DateTime {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(value);
  if (!match) {
    throw new Error(`Invalid LocalDateTime: ${value}`);
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
  };
}

function formatLocalDateTime(dt: DateTime): string {
  return `${pad(dt.year, 4)}-${pad(dt.month, 2)}-${pad(dt.day, 2)}T${pad(dt.hour, 2)}:${pad(dt.minute, 2)}:${pad(dt.second, 2)}`;
}

function pad(value: number, length: number): string {
  return value.toString().padStart(length, "0");
}

function addDays(dt: DateTime, days: number): DateTime {
  const ms = Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute, dt.second) + days * 86400 * 1000;
  const d = new Date(ms);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: dt.hour,
    minute: dt.minute,
    second: dt.second,
  };
}

function addHours(dt: DateTime, hours: number): DateTime {
  const ms = Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute, dt.second) + hours * 3600 * 1000;
  const d = new Date(ms);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

function addMinutes(dt: DateTime, minutes: number): DateTime {
  return addSeconds(dt, minutes * 60);
}

function addSeconds(dt: DateTime, seconds: number): DateTime {
  const ms = Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute, dt.second) + seconds * 1000;
  const d = new Date(ms);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

function addMonths(dt: DateTime, months: number): DateTime {
  const total = (dt.year * 12 + (dt.month - 1)) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const day = Math.min(dt.day, daysInMonth(year, month));
  return { year, month, day, hour: dt.hour, minute: dt.minute, second: dt.second };
}

function dayOfWeek(dt: DateTime): DayOfWeek {
  const d = new Date(Date.UTC(dt.year, dt.month - 1, dt.day));
  const idx = d.getUTCDay();
  if (idx === 0) return "su";
  if (idx === 1) return "mo";
  if (idx === 2) return "tu";
  if (idx === 3) return "we";
  if (idx === 4) return "th";
  if (idx === 5) return "fr";
  return "sa";
}

function dayOfYear(dt: DateTime): number {
  const start = Date.UTC(dt.year, 0, 1);
  const current = Date.UTC(dt.year, dt.month - 1, dt.day);
  return Math.floor((current - start) / (24 * 3600 * 1000)) + 1;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function daysInYear(year: number): number {
  return new Date(Date.UTC(year + 1, 0, 0)).getUTCDate();
}

function startOfWeek(dt: DateTime, firstDay: DayOfWeek): DateTime {
  const order: DayOfWeek[] = ["mo", "tu", "we", "th", "fr", "sa", "su"];
  const dow = dayOfWeek(dt);
  const offset = (order.indexOf(dow) - order.indexOf(firstDay) + 7) % 7;
  return addDays(dt, -offset);
}

function weekNumber(dt: DateTime, firstDay: DayOfWeek): number {
  const yearStart: DateTime = { year: dt.year, month: 1, day: 1, hour: 0, minute: 0, second: 0 };
  const weekStart = startOfWeek(yearStart, firstDay);
  const daysBeforeYear = daysBetween(weekStart, yearStart);
  const daysInFirstWeek = 7 - daysBeforeYear;
  const week1Start = daysInFirstWeek >= 4 ? weekStart : addDays(weekStart, 7);
  if (compareDate(dt, week1Start) < 0) {
    return totalWeeksInYear(dt.year - 1, firstDay);
  }
  const diff = daysBetween(week1Start, dt);
  return Math.floor(diff / 7) + 1;
}

function totalWeeksInYear(year: number, firstDay: DayOfWeek): number {
  const lastDay: DateTime = { year, month: 12, day: 31, hour: 0, minute: 0, second: 0 };
  return weekNumber(lastDay, firstDay);
}

function daysBetween(a: DateTime, b: DateTime): number {
  const msA = Date.UTC(a.year, a.month - 1, a.day);
  const msB = Date.UTC(b.year, b.month - 1, b.day);
  return Math.floor((msB - msA) / (24 * 3600 * 1000));
}

function compareDate(a: DateTime, b: DateTime): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  if (a.day !== b.day) return a.day - b.day;
  return 0;
}
