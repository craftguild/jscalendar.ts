import type { NDay, RecurrenceRule } from "../types.js";
import { FREQ_MONTHLY, FREQ_YEARLY } from "./constants.js";
import type {
    CalendarBackend,
    CalendarDateParts,
    DateCandidate,
    DateTime,
    DayOfWeek,
} from "./types.js";

type MatcherCache = {
    nthPeriodDates: Map<string, CalendarDateParts[]>;
    weeksInYear: Map<string, number>;
};

/**
 * Check whether a candidate date matches BYMONTHDAY values.
 * @param date Candidate date.
 * @param byMonthDay BYMONTHDAY values (positive or negative).
 * @return True when the candidate date matches any BYMONTHDAY value.
 */
export function matchesByMonthDay(
    date: DateCandidate,
    byMonthDay: number[],
    backend: CalendarBackend,
): boolean {
    const dim = backend.daysInMonth(date);
    for (const v of byMonthDay) {
        if (v > 0 && date.day === v) return true;
        if (v < 0 && date.day === dim + v + 1) return true;
    }
    return false;
}

/**
 * Check whether a candidate date matches BYYEARDAY values.
 * @param date Candidate date.
 * @param byYearDay BYYEARDAY values (positive or negative).
 * @return True when the candidate date matches any BYYEARDAY value.
 */
export function matchesByYearDay(
    date: DateCandidate,
    byYearDay: number[],
    backend: CalendarBackend,
): boolean {
    const diy = backend.daysInYear(date.year);
    const doy = backend.dayOfYear(date);
    for (const v of byYearDay) {
        if (v > 0 && doy === v) return true;
        if (v < 0 && doy === diy + v + 1) return true;
    }
    return false;
}

/**
 * Check whether a candidate date matches BYWEEKNO values.
 * @param date Candidate date.
 * @param byWeekNo BYWEEKNO values (positive or negative).
 * @param firstDay First day of the week for week number calculations.
 * @return True when the candidate date matches any BYWEEKNO value.
 */
export function matchesByWeekNo(
    date: DateCandidate,
    byWeekNo: number[],
    backend: CalendarBackend,
    firstDay: DayOfWeek,
    cache?: MatcherCache,
): boolean {
    const week = backend.weekNumber(date, firstDay);
    const total = getWeeksInYear(date.year, backend, firstDay, cache);
    for (const v of byWeekNo) {
        if (v > 0 && week === v) return true;
        if (v < 0 && week === total + v + 1) return true;
    }
    return false;
}

/**
 * Check whether a candidate date matches BYDAY rules.
 * @param date Candidate date.
 * @param byDay BYDAY rules (with optional nth-of-period entries).
 * @param frequency Rule frequency.
 * @param periodStart Start of the current recurrence period.
 * @param firstDay First day of the week for weekly calculations.
 * @return True when the candidate date matches any BYDAY rule.
 */
export function matchesByDay(
    date: DateCandidate,
    byDay: NDay[],
    frequency: RecurrenceRule["frequency"],
    periodStart: DateTime,
    backend: CalendarBackend,
    firstDay: DayOfWeek,
    cache?: MatcherCache,
): boolean {
    const weekday = backend.dayOfWeek(date);
    for (const entry of byDay) {
        if (entry.nthOfPeriod === undefined) {
            if (entry.day === weekday) return true;
            continue;
        }
        if (frequency !== FREQ_MONTHLY && frequency !== FREQ_YEARLY) {
            continue;
        }
        const matches = listNthPeriodDates(
            date,
            frequency,
            periodStart,
            backend,
            firstDay,
            cache,
        ).filter((d) => backend.dayOfWeek(d) === entry.day);
        const index =
            entry.nthOfPeriod > 0
                ? entry.nthOfPeriod - 1
                : matches.length + entry.nthOfPeriod;
        if (index >= 0 && index < matches.length) {
            const target = matches[index];
            if (
                target &&
                target.year === date.year &&
                target.monthCode.value === date.monthCode.value &&
                target.day === date.day
            ) {
                return true;
            }
        }
    }
    return false;
}

/**
 * List dates in the current period for nth-of-period matching.
 * @param date Candidate date (year/month used for period selection).
 * @param frequency Rule frequency.
 * @param periodStart Start of the current recurrence period.
 * @param firstDay First day of the week for weekly calculations.
 * @return Date list used to resolve nth-of-period BYDAY entries.
 */
function listNthPeriodDates(
    date: DateCandidate,
    frequency: RecurrenceRule["frequency"],
    periodStart: DateTime,
    backend: CalendarBackend,
    firstDay: DayOfWeek,
    cache?: MatcherCache,
): CalendarDateParts[] {
    const cacheKey = nthPeriodCacheKey(date, frequency);
    const cached = cache?.nthPeriodDates.get(cacheKey);
    if (cached) {
        return cached;
    }

    if (frequency === FREQ_YEARLY) {
        const result: CalendarDateParts[] = [];
        for (const monthCode of backend.monthsInYear(date.year)) {
            const days = backend.daysInMonth({
                year: date.year,
                monthCode,
                day: 1,
            });
            for (let day = 1; day <= days; day += 1) {
                result.push({
                    year: date.year,
                    monthCode,
                    day,
                });
            }
        }
        cache?.nthPeriodDates.set(cacheKey, result);
        return result;
    }
    if (frequency === FREQ_MONTHLY) {
        const result: CalendarDateParts[] = [];
        const days = backend.daysInMonth(date);
        for (let day = 1; day <= days; day += 1) {
            result.push({
                year: date.year,
                monthCode: date.monthCode,
                day,
            });
        }
        cache?.nthPeriodDates.set(cacheKey, result);
        return result;
    }

    const result: CalendarDateParts[] = [];
    let cursor = periodStart;
    for (let i = 0; i < 7; i += 1) {
        result.push({
            year: cursor.year,
            monthCode: cursor.monthCode,
            day: cursor.day,
        });
        cursor = backend.addDays(cursor, 1);
    }
    cache?.nthPeriodDates.set(cacheKey, result);
    return result;
}

/**
 * Build the cache key for nth-of-period date lists.
 * @param date Candidate date.
 * @param frequency Rule frequency.
 * @return Stable cache key.
 */
function nthPeriodCacheKey(
    date: DateCandidate,
    frequency: RecurrenceRule["frequency"],
): string {
    if (frequency === FREQ_YEARLY) {
        return `year:${date.year}`;
    }
    if (frequency === FREQ_MONTHLY) {
        return `month:${date.year}:${date.monthCode.value}`;
    }
    return `week:${periodDateKey(date)}`;
}

/**
 * Get the number of weeks in a year with memoization.
 * @param year Calendar year.
 * @param backend Calendar backend.
 * @param firstDay First day of week.
 * @param cache Optional matcher cache.
 * @return Number of weeks in the year.
 */
function getWeeksInYear(
    year: number,
    backend: CalendarBackend,
    firstDay: DayOfWeek,
    cache?: MatcherCache,
): number {
    const key = `${year}:${firstDay}`;
    const cached = cache?.weeksInYear.get(key);
    if (cached !== undefined) {
        return cached;
    }
    const value = backend.weeksInYear(year, firstDay);
    cache?.weeksInYear.set(key, value);
    return value;
}

/**
 * Build a simple date key for weekly cache entries.
 * @param date Candidate date.
 * @return Stable cache key.
 */
function periodDateKey(date: DateCandidate): string {
    return `${date.year}:${date.monthCode.value}:${date.day}`;
}
