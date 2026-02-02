import type { RecurrenceRule } from "../types.js";
import { FREQ_DAILY, FREQ_HOURLY, FREQ_MINUTELY, FREQ_MONTHLY, FREQ_SECONDLY, FREQ_WEEKLY, FREQ_YEARLY, SKIP_BACKWARD, SKIP_FORWARD, SKIP_OMIT } from "./constants.js";
import type { DateCandidate, DateTime, DayOfWeek } from "./types.js";
import { addDays, addMonths, daysInMonth, pad } from "./date-utils.js";
import { matchesByDay, matchesByMonthDay, matchesByWeekNo, matchesByYearDay } from "./rule-matchers.js";

/**
 * Build candidate dates for the current recurrence period.
 * @param periodStart Start of the current recurrence period.
 * @param rule Normalized recurrence rule.
 * @param firstDay First day of the week for weekly calculations.
 * @param skip Skip policy for invalid month days.
 * @return Candidate dates for further filtering.
 */
export function generateDateCandidates(
  periodStart: DateTime,
  rule: RecurrenceRule,
  firstDay: DayOfWeek,
  skip: string,
): DateCandidate[] {
  const result: DateCandidate[] = [];
  const wantsInvalid = skip !== SKIP_OMIT && rule.byMonthDay && rule.byMonthDay.length > 0;

  if (rule.frequency === FREQ_YEARLY) {
    for (let month = 1; month <= 12; month += 1) {
      const maxDays = wantsInvalid ? 31 : daysInMonth(periodStart.year, month);
      for (let day = 1; day <= maxDays; day += 1) {
        const valid = day <= daysInMonth(periodStart.year, month);
        result.push({ year: periodStart.year, month, day, valid });
      }
    }
    return result;
  }

  if (rule.frequency === FREQ_MONTHLY) {
    const maxDays = wantsInvalid ? 31 : daysInMonth(periodStart.year, periodStart.month);
    for (let day = 1; day <= maxDays; day += 1) {
      const valid = day <= daysInMonth(periodStart.year, periodStart.month);
      result.push({ year: periodStart.year, month: periodStart.month, day, valid });
    }
    return result;
  }

  if (rule.frequency === FREQ_WEEKLY) {
    let cursor = periodStart;
    for (let i = 0; i < 7; i += 1) {
      result.push({ year: cursor.year, month: cursor.month, day: cursor.day, valid: true });
      cursor = addDays(cursor, 1);
    }
    return result;
  }

  if (rule.frequency === FREQ_DAILY) {
    result.push({ year: periodStart.year, month: periodStart.month, day: periodStart.day, valid: true });
    return result;
  }

  if (rule.frequency === FREQ_HOURLY || rule.frequency === FREQ_MINUTELY || rule.frequency === FREQ_SECONDLY) {
    result.push({ year: periodStart.year, month: periodStart.month, day: periodStart.day, valid: true });
    return result;
  }

  return result;
}

/**
 * Apply BY* filters and skip behavior to candidate dates.
 * @param candidates Candidate dates for the period.
 * @param rule Normalized recurrence rule.
 * @param periodStart Start of the current recurrence period.
 * @param firstDay First day of the week for weekly calculations.
 * @param skip Skip policy for invalid month days.
 * @return Filtered candidate dates.
 */
export function filterDateCandidates(
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
    const byWeekNo = rule.byWeekNo.filter((d) => d !== 0);
    result = result.filter((d) => d.valid && matchesByWeekNo(d, byWeekNo, firstDay));
  }

  if (rule.byYearDay && rule.byYearDay.length > 0) {
    const byYearDay = rule.byYearDay.filter((d) => d !== 0);
    result = result.filter((d) => d.valid && matchesByYearDay(d, byYearDay));
  }

  if (rule.byMonthDay && rule.byMonthDay.length > 0) {
    const byMonthDay = rule.byMonthDay.filter((d) => d !== 0);
    result = result.filter((d) => matchesByMonthDay(d, byMonthDay));
  }

  const byDay = rule.byDay;
  if (byDay && byDay.length > 0) {
    result = result.filter((d) => matchesByDay(d, byDay, rule.frequency, periodStart, firstDay));
  }

  if (skip !== SKIP_OMIT && rule.byMonthDay && rule.byMonthDay.length > 0) {
    result = adjustInvalidMonthDays(result, skip);
  } else {
    result = result.filter((d) => d.valid);
  }

  return result;
}

/**
 * Shift invalid month-day candidates using the skip policy.
 * @param candidates Candidate dates that may include invalid month days.
 * @param skip Skip policy for invalid month days.
 * @return Candidates with invalid days adjusted or removed.
 */
function adjustInvalidMonthDays(candidates: DateCandidate[], skip: string): DateCandidate[] {
  const adjusted: DateCandidate[] = [];
  for (const candidate of candidates) {
    if (candidate.valid) {
      adjusted.push(candidate);
      continue;
    }
    if (skip === SKIP_FORWARD) {
      const next = addMonths({ year: candidate.year, month: candidate.month, day: 1, hour: 0, minute: 0, second: 0 }, 1);
      adjusted.push({ year: next.year, month: next.month, day: 1, valid: true });
    } else if (skip === SKIP_BACKWARD) {
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
