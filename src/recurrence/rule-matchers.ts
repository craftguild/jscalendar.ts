import type { NDay, RecurrenceRule } from "../types.js";
import { FREQ_MONTHLY, FREQ_YEARLY } from "./constants.js";
import type { DateCandidate, DateTime, DayOfWeek } from "./types.js";
import {
    addDays,
    dayOfWeek,
    dayOfYear,
    daysInMonth,
    daysInYear,
    totalWeeksInYear,
    weekNumber,
} from "./date-utils.js";

/**
 * Check whether a candidate date matches BYMONTHDAY values.
 * @param date Candidate date.
 * @param byMonthDay BYMONTHDAY values (positive or negative).
 * @return True when the candidate date matches any BYMONTHDAY value.
 */
export function matchesByMonthDay(
    date: DateCandidate,
    byMonthDay: number[],
): boolean {
    const dim = daysInMonth(date.year, date.month);
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
): boolean {
    const diy = daysInYear(date.year);
    const doy = dayOfYear({
        year: date.year,
        month: date.month,
        day: date.day,
        hour: 0,
        minute: 0,
        second: 0,
    });
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
    firstDay: DayOfWeek,
): boolean {
    const week = weekNumber(
        {
            year: date.year,
            month: date.month,
            day: date.day,
            hour: 0,
            minute: 0,
            second: 0,
        },
        firstDay,
    );
    const total = totalWeeksInYear(date.year, firstDay);
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
    firstDay: DayOfWeek,
): boolean {
    const weekday = dayOfWeek({
        year: date.year,
        month: date.month,
        day: date.day,
        hour: 0,
        minute: 0,
        second: 0,
    });
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
            firstDay,
        ).filter((d) => dayOfWeek(d) === entry.day);
        const index =
            entry.nthOfPeriod > 0
                ? entry.nthOfPeriod - 1
                : matches.length + entry.nthOfPeriod;
        if (index >= 0 && index < matches.length) {
            const target = matches[index];
            if (
                target &&
                target.year === date.year &&
                target.month === date.month &&
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
    firstDay: DayOfWeek,
): DateTime[] {
    if (frequency === FREQ_YEARLY) {
        const result: DateTime[] = [];
        for (let month = 1; month <= 12; month += 1) {
            const days = daysInMonth(date.year, month);
            for (let day = 1; day <= days; day += 1) {
                result.push({
                    year: date.year,
                    month,
                    day,
                    hour: 0,
                    minute: 0,
                    second: 0,
                });
            }
        }
        return result;
    }
    if (frequency === FREQ_MONTHLY) {
        const result: DateTime[] = [];
        const days = daysInMonth(date.year, date.month);
        for (let day = 1; day <= days; day += 1) {
            result.push({
                year: date.year,
                month: date.month,
                day,
                hour: 0,
                minute: 0,
                second: 0,
            });
        }
        return result;
    }

    const result: DateTime[] = [];
    let cursor = periodStart;
    for (let i = 0; i < 7; i += 1) {
        result.push({
            year: cursor.year,
            month: cursor.month,
            day: cursor.day,
            hour: 0,
            minute: 0,
            second: 0,
        });
        cursor = addDays(cursor, 1);
    }
    return result;
}
