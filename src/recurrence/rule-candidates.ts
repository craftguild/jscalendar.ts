import type { RecurrenceRule } from "../types.js";
import {
    FREQ_DAILY,
    FREQ_HOURLY,
    FREQ_MINUTELY,
    FREQ_MONTHLY,
    FREQ_SECONDLY,
    FREQ_WEEKLY,
    FREQ_YEARLY,
    SKIP_BACKWARD,
    SKIP_FORWARD,
    SKIP_OMIT,
} from "./constants.js";
import {
    matchesByDay,
    matchesByMonthDay,
    matchesByWeekNo,
    matchesByYearDay,
} from "./rule-matchers.js";

import { parseMonthToken } from "./month-tokens.js";
import type {
    CalendarBackend,
    CalendarMonthCode,
    DateCandidate,
    DateTime,
    DayOfWeek,
} from "./types.js";
import { pad } from "./date-utils.js";

const WEEK_ORDER: DayOfWeek[] = ["mo", "tu", "we", "th", "fr", "sa", "su"];

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
    backend: CalendarBackend,
    firstDay: DayOfWeek,
    skip: string,
): DateCandidate[] {
    const result: DateCandidate[] = [];
    const byMonthDay = rule.byMonthDay?.filter((day) => day !== 0);

    if (rule.frequency === FREQ_YEARLY) {
        if (byMonthDay && byMonthDay.length > 0) {
            for (const monthCode of backend.monthsInYear(periodStart.year)) {
                result.push(
                    ...buildMonthDayCandidates(
                        periodStart.year,
                        monthCode,
                        byMonthDay,
                        backend,
                    ),
                );
            }
            return result;
        }

        for (const monthCode of backend.monthsInYear(periodStart.year)) {
            const maxDays = backend.daysInMonth({
                year: periodStart.year,
                monthCode,
                day: 1,
            });
            for (let day = 1; day <= maxDays; day += 1) {
                result.push({
                    year: periodStart.year,
                    monthCode,
                    day,
                    valid: true,
                });
            }
        }
        return result;
    }

    if (rule.frequency === FREQ_MONTHLY) {
        if (byMonthDay && byMonthDay.length > 0) {
            return buildMonthDayCandidates(
                periodStart.year,
                periodStart.monthCode,
                byMonthDay,
                backend,
            );
        }

        const maxDays = backend.daysInMonth(periodStart);
        for (let day = 1; day <= maxDays; day += 1) {
            result.push({
                year: periodStart.year,
                monthCode: periodStart.monthCode,
                day,
                valid: true,
            });
        }
        return result;
    }

    if (rule.frequency === FREQ_WEEKLY) {
        let cursor = startOfWeek(periodStart, firstDay, backend);
        for (let i = 0; i < 7; i += 1) {
            result.push({
                year: cursor.year,
                monthCode: cursor.monthCode,
                day: cursor.day,
                valid: true,
            });
            cursor = backend.addDays(cursor, 1);
        }
        return result;
    }

    if (rule.frequency === FREQ_DAILY) {
        result.push({
            year: periodStart.year,
            monthCode: periodStart.monthCode,
            day: periodStart.day,
            valid: true,
        });
        return result;
    }

    if (
        rule.frequency === FREQ_HOURLY ||
        rule.frequency === FREQ_MINUTELY ||
        rule.frequency === FREQ_SECONDLY
    ) {
        result.push({
            year: periodStart.year,
            monthCode: periodStart.monthCode,
            day: periodStart.day,
            valid: true,
        });
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
    backend: CalendarBackend,
    firstDay: DayOfWeek,
    skip: string,
): DateCandidate[] {
    let result = candidates;

    if (rule.byMonth && rule.byMonth.length > 0) {
        const months = rule.byMonth.map(parseMonthToken);
        const resolvedMonths = resolveByMonthFilter(
            periodStart.year,
            months,
            backend,
            skip,
            rule.byMonth,
        );
        result = result.filter((d) =>
            resolvedMonths.some(
                (month) =>
                    month.year === d.year &&
                    month.monthCode.ordinal === d.monthCode.ordinal &&
                    month.monthCode.isLeap === d.monthCode.isLeap,
            ),
        );
    }

    if (rule.byWeekNo && rule.byWeekNo.length > 0) {
        const byWeekNo = rule.byWeekNo.filter((d) => d !== 0);
        result = result.filter(
            (d) => d.valid && matchesByWeekNo(d, byWeekNo, backend, firstDay),
        );
    }

    if (rule.byYearDay && rule.byYearDay.length > 0) {
        const byYearDay = rule.byYearDay.filter((d) => d !== 0);
        result = result.filter(
            (d) => d.valid && matchesByYearDay(d, byYearDay, backend),
        );
    }

    if (rule.byMonthDay && rule.byMonthDay.length > 0) {
        const byMonthDay = rule.byMonthDay.filter((d) => d !== 0);
        result = result.filter((d) =>
            matchesByMonthDay(d, byMonthDay, backend),
        );
    }

    if (skip !== SKIP_OMIT && rule.byMonthDay && rule.byMonthDay.length > 0) {
        result = adjustInvalidMonthDays(result, backend, skip);
    } else {
        result = result.filter((d) => d.valid);
    }

    const byDay = rule.byDay;
    if (byDay && byDay.length > 0) {
        result = result.filter((d) =>
            matchesByDay(
                d,
                byDay,
                rule.frequency,
                periodStart,
                backend,
                firstDay,
            ),
        );
    }

    return result;
}

/**
 * Resolve BYMONTH tokens into valid months after applying month skip rules.
 * @param year Active calendar year for the recurrence period.
 * @param months Parsed BYMONTH tokens.
 * @param backend Calendar backend.
 * @param skip Skip policy for invalid months.
 * @param rawMonths Original BYMONTH values for error reporting.
 * @return Valid months to keep for the current period.
 */
function resolveByMonthFilter(
    year: number,
    months: ReturnType<typeof parseMonthToken>[],
    backend: CalendarBackend,
    skip: string,
    rawMonths: string[],
): Array<{ year: number; monthCode: CalendarMonthCode }> {
    const resolved = new Map<string, ReturnType<typeof parseMonthToken>>();

    for (const month of months) {
        const direct = backend.resolveMonthToken(year, month);
        if (direct) {
            resolved.set(direct.value, direct);
            continue;
        }
        if (skip === SKIP_OMIT) {
            continue;
        }

        const direction = skip === SKIP_FORWARD ? "forward" : "backward";
        const adjusted = backend.adjustInvalidMonth(year, month, direction);
        if (!adjusted) {
            throw new Error(
                `Invalid recurrence rule for rscale ${backend.rscale}: BYMONTH=${rawMonths.join(",")}`,
            );
        }
        resolved.set(adjusted.monthCode.value, adjusted.monthCode);
    }

    return Array.from(resolved.values()).map((month) => ({
        monthCode: month,
        year,
    }));
}

/**
 * Shift invalid month-day candidates using the skip policy.
 * @param candidates Candidate dates that may include invalid month days.
 * @param skip Skip policy for invalid month days.
 * @return Candidates with invalid days adjusted or removed.
 */
function adjustInvalidMonthDays(
    candidates: DateCandidate[],
    backend: CalendarBackend,
    skip: string,
): DateCandidate[] {
    const adjusted: DateCandidate[] = [];
    for (const candidate of candidates) {
        if (candidate.valid) {
            adjusted.push(candidate);
            continue;
        }
        const monthStart = {
            year: candidate.year,
            monthCode: candidate.monthCode,
            day: 1,
            hour: 0,
            minute: 0,
            second: 0,
        };
        const monthLength = backend.daysInMonth({
            year: candidate.year,
            monthCode: candidate.monthCode,
            day: 1,
        });
        if (skip === SKIP_FORWARD) {
            if (candidate.day > monthLength) {
                const next = backend.add(monthStart, FREQ_MONTHLY, 1, "mo");
                adjusted.push({
                    year: next.year,
                    monthCode: next.monthCode,
                    day: 1,
                    valid: true,
                });
            } else {
                const previous = backend.addDays(monthStart, -1);
                adjusted.push({
                    year: previous.year,
                    monthCode: previous.monthCode,
                    day: previous.day,
                    valid: true,
                });
            }
        } else if (skip === SKIP_BACKWARD) {
            adjusted.push({
                year: candidate.year,
                monthCode: candidate.monthCode,
                day: candidate.day > monthLength ? monthLength : 1,
                valid: true,
            });
        }
    }

    const deduped = new Map<string, DateCandidate>();
    for (const candidate of adjusted) {
        const key = `${pad(candidate.year, 4)}-${candidate.monthCode.value}-${pad(candidate.day, 2)}`;
        if (!deduped.has(key)) {
            deduped.set(key, candidate);
        }
    }
    return Array.from(deduped.values());
}

/**
 * Build candidates from explicit BYMONTHDAY values, including invalid overflow values.
 * @param year Candidate year.
 * @param monthCode Candidate month.
 * @param byMonthDay Requested BYMONTHDAY values.
 * @param backend Calendar backend.
 * @return Candidate dates for those requested month days.
 */
function buildMonthDayCandidates(
    year: number,
    monthCode: CalendarMonthCode,
    byMonthDay: number[],
    backend: CalendarBackend,
): DateCandidate[] {
    const monthLength = backend.daysInMonth({
        year,
        monthCode,
        day: 1,
    });

    return byMonthDay.map((requestedDay) => {
        const day =
            requestedDay > 0 ? requestedDay : monthLength + requestedDay + 1;
        return {
            year,
            monthCode,
            day,
            valid: day >= 1 && day <= monthLength,
        };
    });
}

/**
 * Find the start of the recurrence week for a calendar-local date.
 * @param value Current period start.
 * @param firstDay First day of week.
 * @param backend Calendar backend.
 * @return Start of week in the active calendar.
 */
function startOfWeek(
    value: DateTime,
    firstDay: DayOfWeek,
    backend: CalendarBackend,
): DateTime {
    const dayIndex = WEEK_ORDER.indexOf(backend.dayOfWeek(value));
    const firstDayIndex = WEEK_ORDER.indexOf(firstDay);
    const offset =
        (dayIndex - firstDayIndex + WEEK_ORDER.length) % WEEK_ORDER.length;
    return backend.addDays(value, -offset);
}
