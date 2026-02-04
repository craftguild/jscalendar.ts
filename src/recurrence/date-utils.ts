import type { DayOfWeek, DateTime } from "./types.js";
import type { RecurrenceRule } from "../types.js";
import {
    FREQ_DAILY,
    FREQ_HOURLY,
    FREQ_MINUTELY,
    FREQ_MONTHLY,
    FREQ_SECONDLY,
    FREQ_WEEKLY,
    FREQ_YEARLY,
} from "./constants.js";

/**
 * Advance a date-time by a recurrence interval.
 * @param start Anchor date-time.
 * @param frequency Recurrence frequency.
 * @param amount Number of intervals to add.
 * @param firstDay First day of week for weekly intervals.
 * @return Date-time moved to the next interval boundary.
 */
export function addInterval(
    start: DateTime,
    frequency: RecurrenceRule["frequency"],
    amount: number,
    firstDay: DayOfWeek,
): DateTime {
    if (frequency === FREQ_YEARLY) {
        return {
            year: start.year + amount,
            month: 1,
            day: 1,
            hour: 0,
            minute: 0,
            second: 0,
        };
    }
    if (frequency === FREQ_MONTHLY) {
        const next = addMonths(start, amount);
        return {
            year: next.year,
            month: next.month,
            day: 1,
            hour: 0,
            minute: 0,
            second: 0,
        };
    }
    if (frequency === FREQ_WEEKLY) {
        const weekStart = startOfWeek(start, firstDay);
        return addDays(weekStart, amount * 7);
    }
    if (frequency === FREQ_DAILY) {
        return addDays(start, amount);
    }
    if (frequency === FREQ_HOURLY) {
        return addHours(start, amount);
    }
    if (frequency === FREQ_MINUTELY) {
        return addMinutes(start, amount);
    }
    return addSeconds(start, amount);
}

/**
 * Parse local date time into structured data.
 * @param value LocalDateTime string.
 * @return Parsed date-time parts.
 */
export function parseLocalDateTime(value: string): DateTime {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(
        value,
    );
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

/**
 * Format local date time as string.
 * @param dt Date-time parts.
 * @return LocalDateTime string.
 */
export function formatLocalDateTime(dt: DateTime): string {
    return `${pad(dt.year, 4)}-${pad(dt.month, 2)}-${pad(dt.day, 2)}T${pad(dt.hour, 2)}:${pad(dt.minute, 2)}:${pad(dt.second, 2)}`;
}

/**
 * Pad a numeric value with leading zeros.
 * @param value Number to pad.
 * @param length Total length.
 * @return Zero-padded string.
 */
export function pad(value: number, length: number): string {
    return value.toString().padStart(length, "0");
}

/**
 * Add days to the target.
 * @param dt Date-time parts.
 * @param days Days to add.
 * @return New date-time with days added.
 */
export function addDays(dt: DateTime, days: number): DateTime {
    const ms =
        Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute, dt.second) +
        days * 86400 * 1000;
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

/**
 * Add hours to the target.
 * @param dt Date-time parts.
 * @param hours Hours to add.
 * @return New date-time with hours added.
 */
export function addHours(dt: DateTime, hours: number): DateTime {
    const ms =
        Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute, dt.second) +
        hours * 3600 * 1000;
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

/**
 * Add minutes to the target.
 * @param dt Date-time parts.
 * @param minutes Minutes to add.
 * @return New date-time with minutes added.
 */
export function addMinutes(dt: DateTime, minutes: number): DateTime {
    return addSeconds(dt, minutes * 60);
}

/**
 * Add seconds to the target.
 * @param dt Date-time parts.
 * @param seconds Seconds to add.
 * @return New date-time with seconds added.
 */
export function addSeconds(dt: DateTime, seconds: number): DateTime {
    const ms =
        Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute, dt.second) +
        seconds * 1000;
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

/**
 * Add months to the target.
 * @param dt Date-time parts.
 * @param months Months to add.
 * @return New date-time with months added.
 */
export function addMonths(dt: DateTime, months: number): DateTime {
    const total = dt.year * 12 + (dt.month - 1) + months;
    const year = Math.floor(total / 12);
    const month = (total % 12) + 1;
    const day = Math.min(dt.day, daysInMonth(year, month));
    return {
        year,
        month,
        day,
        hour: dt.hour,
        minute: dt.minute,
        second: dt.second,
    };
}

/**
 * Get day of week for a date-time.
 * @param dt Date-time parts.
 * @return Two-letter weekday code.
 */
export function dayOfWeek(dt: DateTime): DayOfWeek {
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

/**
 * Get day of year for a date-time.
 * @param dt Date-time parts.
 * @return Day of year (1-366).
 */
export function dayOfYear(dt: DateTime): number {
    const start = Date.UTC(dt.year, 0, 1);
    const current = Date.UTC(dt.year, dt.month - 1, dt.day);
    return Math.floor((current - start) / (24 * 3600 * 1000)) + 1;
}

/**
 * Get number of days in a month.
 * @param year Year number.
 * @param month Month number (1-12).
 * @return Days in the month.
 */
export function daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Get number of days in a year.
 * @param year Year number.
 * @return Days in the year.
 */
export function daysInYear(year: number): number {
    return new Date(Date.UTC(year + 1, 0, 0)).getUTCDate();
}

/**
 * Get the start of week for a date-time.
 * @param dt Date-time parts.
 * @param firstDay Weekday that starts the week.
 * @return Date-time at the start of the week.
 */
export function startOfWeek(dt: DateTime, firstDay: DayOfWeek): DateTime {
    const order: DayOfWeek[] = ["mo", "tu", "we", "th", "fr", "sa", "su"];
    const dow = dayOfWeek(dt);
    const offset = (order.indexOf(dow) - order.indexOf(firstDay) + 7) % 7;
    return addDays(dt, -offset);
}

/**
 * Get ISO-like week number for a date-time.
 * @param dt Date-time parts.
 * @param firstDay Weekday that starts the week.
 * @return Week number for the given date.
 */
export function weekNumber(dt: DateTime, firstDay: DayOfWeek): number {
    const yearStart: DateTime = {
        year: dt.year,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
    };
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

/**
 * Get total weeks in a year.
 * @param year Year number.
 * @param firstDay Weekday that starts the week.
 * @return Total number of weeks in the year.
 */
export function totalWeeksInYear(year: number, firstDay: DayOfWeek): number {
    const lastDay: DateTime = {
        year,
        month: 12,
        day: 31,
        hour: 0,
        minute: 0,
        second: 0,
    };
    return weekNumber(lastDay, firstDay);
}

/**
 * Get whole-day difference between two dates.
 * @param a Start date.
 * @param b End date.
 * @return Whole-day difference (b - a).
 */
export function daysBetween(a: DateTime, b: DateTime): number {
    const msA = Date.UTC(a.year, a.month - 1, a.day);
    const msB = Date.UTC(b.year, b.month - 1, b.day);
    return Math.floor((msB - msA) / (24 * 3600 * 1000));
}

/**
 * Compare two dates without time.
 * @param a First date.
 * @param b Second date.
 * @return Negative/zero/positive comparison result.
 */
export function compareDate(a: DateTime, b: DateTime): number {
    if (a.year !== b.year) return a.year - b.year;
    if (a.month !== b.month) return a.month - b.month;
    if (a.day !== b.day) return a.day - b.day;
    return 0;
}
