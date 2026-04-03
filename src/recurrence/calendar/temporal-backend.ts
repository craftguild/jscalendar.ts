import type { RecurrenceRule } from "../../types.js";
import {
    FREQ_DAILY,
    FREQ_HOURLY,
    FREQ_MINUTELY,
    FREQ_MONTHLY,
    FREQ_SECONDLY,
    FREQ_WEEKLY,
    FREQ_YEARLY,
} from "../constants.js";
import type { DayOfWeek } from "../types.js";
import { pad } from "../date-utils.js";
import { resolveRscaleDefinition } from "./rscale-registry.js";
import { Temporal } from "./temporal.js";
import type {
    DurationLike,
    PlainDate,
    PlainDateTime,
    ZonedDateTime,
} from "./temporal.js";
import type {
    CalendarBackendScopeCache,
    CalendarBackend,
    CalendarDateParts,
    CalendarDateTimeParts,
    CalendarMonthCode,
    CalendarYearScopeCache,
} from "./types.js";

const DAY_INDEX = new Map<number, DayOfWeek>([
    [1, "mo"],
    [2, "tu"],
    [3, "we"],
    [4, "th"],
    [5, "fr"],
    [6, "sa"],
    [7, "su"],
]);

const WEEK_ORDER: DayOfWeek[] = ["mo", "tu", "we", "th", "fr", "sa", "su"];
const START_DAY = 1;
const START_HOUR = 0;
const START_MINUTE = 0;
const START_SECOND = 0;
const ISO_CALENDAR = "iso8601";
const BACKEND_CACHE = new Map<string, CalendarBackend>();
const AVAILABLE_CALENDARS = new Set<string>();
const UNAVAILABLE_CALENDARS = new Set<string>();
const MONTH_CODE_CACHE = new Map<string, CalendarMonthCode>();

/**
 * Create a Temporal-backed calendar strategy for a recurrence rule.
 * @param rscale RSCALE value from the recurrence rule.
 * @return Calendar backend for that RSCALE.
 */
export function createCalendarBackendOrThrow(rscale?: string): CalendarBackend {
    const definition = resolveRscaleDefinition(rscale);
    ensureCalendarAvailable(
        definition.calendarId,
        definition.canonical,
        rscale,
    );
    const cached = BACKEND_CACHE.get(definition.canonical);
    if (cached) {
        return cached;
    }
    const backend = new TemporalCalendarBackend(
        definition.canonical,
        definition.calendarId,
    );
    BACKEND_CACHE.set(definition.canonical, backend);
    return backend;
}

/**
 * Temporal implementation of the recurrence calendar strategy.
 */
class TemporalCalendarBackend implements CalendarBackend {
    readonly rscale: string;
    private readonly calendarId: string;
    private readonly cache: CalendarBackendScopeCache = {
        years: new Map<number, CalendarYearScopeCache>(),
        fromGregorianLocal: new Map<string, CalendarDateTimeParts>(),
        toGregorianLocal: new Map<string, string>(),
        plainDates: new Map<string, PlainDate>(),
        plainDateTimes: new Map<string, PlainDateTime>(),
    };

    /**
     * Build a backend bound to a canonical RSCALE and Temporal calendar.
     * @param rscale Canonical recurrence scale.
     * @param calendarId Temporal calendar identifier.
     */
    constructor(rscale: string, calendarId: string) {
        this.rscale = rscale;
        this.calendarId = calendarId;
    }

    /**
     * Convert Gregorian local date-time into calendar-local parts.
     * @param localDateTime Gregorian local date-time string.
     * @param timeZone Optional recurrence ID time zone.
     * @return Calendar-local date-time parts.
     */
    fromGregorianLocal(
        localDateTime: string,
        timeZone?: string | null,
    ): CalendarDateTimeParts {
        const cacheKey = `${timeZone ?? ""}|${localDateTime}`;
        const cached = this.cache.fromGregorianLocal.get(cacheKey);
        if (cached) {
            return cached;
        }
        const plain = Temporal.PlainDateTime.from(localDateTime);
        if (timeZone) {
            const instant = plain.toZonedDateTime(timeZone).toInstant();
            const converted = fromZonedDateTime(
                instant
                    .toZonedDateTimeISO(timeZone)
                    .withCalendar(this.calendarId),
            );
            this.cache.fromGregorianLocal.set(cacheKey, converted);
            return converted;
        }
        const converted = fromPlainDateTime(
            plain.withCalendar(this.calendarId),
        );
        this.cache.fromGregorianLocal.set(cacheKey, converted);
        return converted;
    }

    /**
     * Convert calendar-local parts into Gregorian local date-time.
     * @param value Calendar-local date-time parts.
     * @param timeZone Optional recurrence ID time zone.
     * @return Gregorian local date-time string.
     */
    toGregorianLocal(
        value: CalendarDateTimeParts,
        timeZone?: string | null,
    ): string {
        const cacheKey = `${timeZone ?? ""}|${dateTimeCacheKey(value)}`;
        const cached = this.cache.toGregorianLocal.get(cacheKey);
        if (cached) {
            return cached;
        }
        if (timeZone) {
            const zoned = Temporal.ZonedDateTime.from({
                calendar: this.calendarId,
                timeZone,
                year: value.year,
                monthCode: value.monthCode.value,
                day: value.day,
                hour: value.hour,
                minute: value.minute,
                second: value.second,
            }).withCalendar(ISO_CALENDAR);
            const formatted = formatIsoLike(zoned);
            this.cache.toGregorianLocal.set(cacheKey, formatted);
            return formatted;
        }
        const plain = Temporal.PlainDateTime.from({
            calendar: this.calendarId,
            year: value.year,
            monthCode: value.monthCode.value,
            day: value.day,
            hour: value.hour,
            minute: value.minute,
            second: value.second,
        }).withCalendar(ISO_CALENDAR);
        const formatted = formatIsoLike(plain);
        this.cache.toGregorianLocal.set(cacheKey, formatted);
        return formatted;
    }

    /**
     * Add a recurrence interval using calendar-aware arithmetic.
     * @param value Current cursor.
     * @param frequency Recurrence frequency.
     * @param amount Interval amount.
     * @param firstDay First day of week.
     * @return Shifted cursor.
     */
    add(
        value: CalendarDateTimeParts,
        frequency: RecurrenceRule["frequency"],
        amount: number,
        firstDay: DayOfWeek,
    ): CalendarDateTimeParts {
        if (frequency === FREQ_YEARLY) {
            return this.startOfYear(
                this.addPlainDateTime(value, { years: amount }),
            );
        }
        if (frequency === FREQ_MONTHLY) {
            return this.startOfMonth(
                this.addPlainDateTime(value, { months: amount }),
            );
        }
        if (frequency === FREQ_WEEKLY) {
            const startOfWeek = this.startOfWeek(value, firstDay);
            return this.addPlainDateTime(startOfWeek, { days: amount * 7 });
        }
        if (frequency === FREQ_DAILY) {
            return this.addPlainDateTime(value, { days: amount });
        }
        if (frequency === FREQ_HOURLY) {
            return this.addPlainDateTime(value, { hours: amount });
        }
        if (frequency === FREQ_MINUTELY) {
            return this.addPlainDateTime(value, { minutes: amount });
        }
        if (frequency === FREQ_SECONDLY) {
            return this.addPlainDateTime(value, { seconds: amount });
        }
        return value;
    }

    /**
     * Add days using calendar-aware arithmetic.
     * @param value Calendar-local date-time.
     * @param amount Number of days to add.
     * @return Shifted date-time.
     */
    addDays(
        value: CalendarDateTimeParts,
        amount: number,
    ): CalendarDateTimeParts {
        return this.addPlainDateTime(value, { days: amount });
    }

    /**
     * Compare two calendar-local dates without time.
     * @param a First date.
     * @param b Second date.
     * @return Negative/zero/positive comparison result.
     */
    compareDate(a: CalendarDateParts, b: CalendarDateParts): number {
        return Temporal.PlainDate.compare(
            this.toPlainDate(a),
            this.toPlainDate(b),
        );
    }

    /**
     * Get the whole-day difference between two dates.
     * @param a Start date.
     * @param b End date.
     * @return Whole-day difference.
     */
    daysBetween(a: CalendarDateParts, b: CalendarDateParts): number {
        return this.toPlainDate(a).until(this.toPlainDate(b), {
            largestUnit: "day",
        }).days;
    }

    /**
     * Get months present in a calendar year.
     * @param year Calendar year.
     * @return Month codes in order.
     */
    monthsInYear(year: number): CalendarMonthCode[] {
        const yearCache = this.yearScope(year);
        const cached = yearCache.monthsInYear;
        if (cached) {
            return cached;
        }
        const months: CalendarMonthCode[] = [];
        let cursor = Temporal.PlainDate.from({
            calendar: this.calendarId,
            year,
            month: START_DAY,
            day: START_DAY,
        });
        while (cursor.year === year) {
            const monthCode = buildMonthCode(cursor.monthCode);
            const previous = months[months.length - 1];
            if (!previous || previous.value !== monthCode.value) {
                months.push(monthCode);
            }
            cursor = cursor.add({ months: 1 });
        }
        yearCache.monthsInYear = months;
        return months;
    }

    /**
     * Resolve a BYMONTH token in a specific year.
     * @param year Calendar year.
     * @param token Parsed BYMONTH token.
     * @return Matching month code when available.
     */
    resolveMonthToken(
        year: number,
        token: CalendarMonthCode,
    ): CalendarMonthCode | undefined {
        const yearCache = this.yearScope(year);
        const cacheKey = token.value;
        if (yearCache.monthTokenResolution.has(cacheKey)) {
            return yearCache.monthTokenResolution.get(cacheKey) ?? undefined;
        }
        const resolved = this.monthsInYear(year).find(
            (month) =>
                month.ordinal === token.ordinal &&
                month.isLeap === token.isLeap,
        );
        yearCache.monthTokenResolution.set(cacheKey, resolved ?? null);
        return resolved;
    }

    /**
     * Adjust a missing BYMONTH token to the nearest valid month in the same year.
     * @param year Calendar year.
     * @param token Parsed BYMONTH token.
     * @param direction Skip direction.
     * @return Adjusted month reference when available.
     */
    adjustInvalidMonth(
        year: number,
        token: CalendarMonthCode,
        direction: "forward" | "backward",
    ): { year: number; monthCode: CalendarMonthCode } | undefined {
        const months = this.monthsInYear(year);
        let previous: CalendarMonthCode | undefined;

        for (const month of months) {
            const comparison = compareMonthCode(month, token);
            if (comparison === 0) {
                return { year, monthCode: month };
            }
            if (comparison < 0) {
                previous = month;
                continue;
            }
            if (direction === "forward") {
                return { year, monthCode: month };
            }
            break;
        }

        if (direction === "backward" && previous) {
            return { year, monthCode: previous };
        }
        return undefined;
    }

    /**
     * Get the number of days in a month.
     * @param value Calendar date.
     * @return Number of days.
     */
    daysInMonth(value: CalendarDateParts): number {
        const monthCache = this.monthScope(value.year, value.monthCode.value);
        if (monthCache.daysInMonth !== undefined) {
            return monthCache.daysInMonth;
        }
        const days = this.toPlainDate(value).daysInMonth;
        monthCache.daysInMonth = days;
        return days;
    }

    /**
     * Get the number of days in a year.
     * @param year Calendar year.
     * @return Number of days.
     */
    daysInYear(year: number): number {
        const yearCache = this.yearScope(year);
        if (yearCache.daysInYear !== undefined) {
            return yearCache.daysInYear;
        }
        const days = Temporal.PlainDate.from({
            calendar: this.calendarId,
            year,
            month: START_DAY,
            day: START_DAY,
        }).daysInYear;
        yearCache.daysInYear = days;
        return days;
    }

    /**
     * Get the weekday for a calendar-local date.
     * @param value Calendar date.
     * @return Two-letter weekday code.
     */
    dayOfWeek(value: CalendarDateParts): DayOfWeek {
        const dateCache = this.dateScope(value);
        if (dateCache.dayOfWeek) {
            return dateCache.dayOfWeek;
        }
        const dayOfWeek =
            DAY_INDEX.get(this.toPlainDate(value).dayOfWeek) ?? "su";
        dateCache.dayOfWeek = dayOfWeek;
        return dayOfWeek;
    }

    /**
     * Get the day-of-year index for a calendar-local date.
     * @param value Calendar date.
     * @return Day of year.
     */
    dayOfYear(value: CalendarDateParts): number {
        const dateCache = this.dateScope(value);
        if (dateCache.dayOfYear !== undefined) {
            return dateCache.dayOfYear;
        }
        const dayOfYear = this.toPlainDate(value).dayOfYear;
        dateCache.dayOfYear = dayOfYear;
        return dayOfYear;
    }

    /**
     * Get the week number for a calendar-local date.
     * @param value Calendar date.
     * @param firstDay First day of week.
     * @return Week number.
     */
    weekNumber(value: CalendarDateParts, firstDay: DayOfWeek): number {
        const week1Start = this.week1Start(value.year, firstDay);
        if (this.compareDate(value, week1Start) < 0) {
            return this.weeksInYear(value.year - 1, firstDay);
        }
        const nextWeek1Start = this.week1Start(value.year + 1, firstDay);
        if (this.compareDate(value, nextWeek1Start) >= 0) {
            return 1;
        }
        const diff = this.daysBetween(week1Start, value);
        return Math.floor(diff / 7) + 1;
    }

    /**
     * Get the number of weeks in a year.
     * @param year Calendar year.
     * @param firstDay First day of week.
     * @return Total weeks in the year.
     */
    weeksInYear(year: number, firstDay: DayOfWeek): number {
        const yearCache = this.yearScope(year);
        const cached = yearCache.weeksInYearByFirstDay.get(firstDay);
        if (cached !== undefined) {
            return cached;
        }
        const start = this.week1Start(year, firstDay);
        const next = this.week1Start(year + 1, firstDay);
        const weeks = this.daysBetween(start, next) / 7;
        yearCache.weeksInYearByFirstDay.set(firstDay, weeks);
        return weeks;
    }

    /**
     * Convert calendar-local date parts into a PlainDate.
     * @param value Calendar date parts.
     * @return Temporal PlainDate value.
     */
    private toPlainDate(value: CalendarDateParts): PlainDate {
        const cacheKey = dateCacheKey(value);
        const cached = this.cache.plainDates.get(cacheKey);
        if (cached) {
            return cached;
        }
        const plainDate = Temporal.PlainDate.from({
            calendar: this.calendarId,
            year: value.year,
            monthCode: value.monthCode.value,
            day: value.day,
        });
        this.cache.plainDates.set(cacheKey, plainDate);
        return plainDate;
    }

    /**
     * Convert calendar-local date-time parts into a PlainDateTime.
     * @param value Calendar date-time parts.
     * @return Temporal PlainDateTime value.
     */
    private toPlainDateTime(value: CalendarDateTimeParts): PlainDateTime {
        const cacheKey = dateTimeCacheKey(value);
        const cached = this.cache.plainDateTimes.get(cacheKey);
        if (cached) {
            return cached;
        }
        const plainDateTime = Temporal.PlainDateTime.from({
            calendar: this.calendarId,
            year: value.year,
            monthCode: value.monthCode.value,
            day: value.day,
            hour: value.hour,
            minute: value.minute,
            second: value.second,
        });
        this.cache.plainDateTimes.set(cacheKey, plainDateTime);
        return plainDateTime;
    }

    /**
     * Add a Temporal duration and convert back into recurrence parts.
     * @param value Current calendar-local value.
     * @param duration Duration to add.
     * @return Shifted calendar-local value.
     */
    private addPlainDateTime(
        value: CalendarDateTimeParts,
        duration: DurationLike,
    ): CalendarDateTimeParts {
        return fromPlainDateTime(this.toPlainDateTime(value).add(duration));
    }

    /**
     * Move a value to the first day of its calendar year.
     * @param value Calendar-local date-time.
     * @return Value aligned to the start of the year.
     */
    private startOfYear(value: CalendarDateTimeParts): CalendarDateTimeParts {
        return {
            year: value.year,
            monthCode:
                this.monthsInYear(value.year)[0] ?? buildMonthCode("M01"),
            day: START_DAY,
            hour: START_HOUR,
            minute: START_MINUTE,
            second: START_SECOND,
        };
    }

    /**
     * Move a value to the first day of its calendar month.
     * @param value Calendar-local date-time.
     * @return Value aligned to the start of the month.
     */
    private startOfMonth(value: CalendarDateTimeParts): CalendarDateTimeParts {
        return {
            year: value.year,
            monthCode: value.monthCode,
            day: START_DAY,
            hour: START_HOUR,
            minute: START_MINUTE,
            second: START_SECOND,
        };
    }

    /**
     * Move a value to the configured start of week.
     * @param value Calendar-local date-time.
     * @param firstDay First day of week.
     * @return Week start in the same calendar.
     */
    private startOfWeek(
        value: CalendarDateTimeParts,
        firstDay: DayOfWeek,
    ): CalendarDateTimeParts {
        const offset =
            (WEEK_ORDER.indexOf(this.dayOfWeek(value)) -
                WEEK_ORDER.indexOf(firstDay) +
                7) %
            7;
        return this.addDays(value, -offset);
    }

    /**
     * Resolve the first week-year boundary for a calendar year.
     * @param year Calendar year.
     * @param firstDay First day of week.
     * @return Start date of week 1.
     */
    week1Start(year: number, firstDay: DayOfWeek): CalendarDateParts {
        const yearCache = this.yearScope(year);
        const cached = yearCache.week1StartByFirstDay.get(firstDay);
        if (cached) {
            return cached;
        }
        const yearStart: CalendarDateTimeParts = {
            year,
            monthCode: this.monthsInYear(year)[0] ?? buildMonthCode("M01"),
            day: START_DAY,
            hour: START_HOUR,
            minute: START_MINUTE,
            second: START_SECOND,
        };
        const weekStart = this.startOfWeek(yearStart, firstDay);
        const daysBeforeYear = this.daysBetween(weekStart, yearStart);
        const daysInFirstWeek = 7 - daysBeforeYear;
        const week1Start =
            daysInFirstWeek >= 4 ? weekStart : this.addDays(weekStart, 7);
        const resolved = {
            year: week1Start.year,
            monthCode: week1Start.monthCode,
            day: week1Start.day,
        };
        yearCache.week1StartByFirstDay.set(firstDay, resolved);
        return resolved;
    }

    /**
     * Resolve or initialize the year-scoped backend cache.
     * @param year Calendar year.
     * @return Mutable year-scoped cache bucket.
     */
    private yearScope(year: number): CalendarYearScopeCache {
        const cached = this.cache.years.get(year);
        if (cached) {
            return cached;
        }
        const created: CalendarYearScopeCache = {
            week1StartByFirstDay: new Map<DayOfWeek, CalendarDateParts>(),
            weeksInYearByFirstDay: new Map<DayOfWeek, number>(),
            monthTokenResolution: new Map<string, CalendarMonthCode | null>(),
            months: new Map<string, { daysInMonth?: number }>(),
            dates: new Map<
                string,
                { dayOfWeek?: DayOfWeek; dayOfYear?: number }
            >(),
        };
        this.cache.years.set(year, created);
        return created;
    }

    /**
     * Resolve or initialize the month-scoped cache for a year.
     * @param year Calendar year.
     * @param monthCode Calendar month code.
     * @return Mutable month-scoped cache bucket.
     */
    private monthScope(
        year: number,
        monthCode: string,
    ): { daysInMonth?: number } {
        const yearCache = this.yearScope(year);
        const cached = yearCache.months.get(monthCode);
        if (cached) {
            return cached;
        }
        const created = { daysInMonth: undefined };
        yearCache.months.set(monthCode, created);
        return created;
    }

    /**
     * Resolve or initialize the date-scoped cache for a year.
     * @param value Calendar date parts.
     * @return Mutable date-scoped cache bucket.
     */
    private dateScope(value: CalendarDateParts): {
        dayOfWeek?: DayOfWeek;
        dayOfYear?: number;
    } {
        const yearCache = this.yearScope(value.year);
        const cacheKey = `${value.monthCode.value}:${value.day}`;
        const cached = yearCache.dates.get(cacheKey);
        if (cached) {
            return cached;
        }
        const created = { dayOfWeek: undefined, dayOfYear: undefined };
        yearCache.dates.set(cacheKey, created);
        return created;
    }
}

/**
 * Ensure the active runtime can construct dates in the requested calendar.
 * @param calendarId Temporal calendar identifier.
 * @param canonical Canonical RSCALE value.
 * @param input Original RSCALE input.
 * @return Nothing.
 */
function ensureCalendarAvailable(
    calendarId: string,
    canonical: string,
    input?: string,
): void {
    if (AVAILABLE_CALENDARS.has(calendarId)) {
        return;
    }
    if (UNAVAILABLE_CALENDARS.has(calendarId)) {
        const value = input ?? canonical;
        throw new Error(
            `Unsupported rscale: ${value} (calendar backend is not available in this runtime)`,
        );
    }
    try {
        Temporal.PlainDate.from({
            calendar: calendarId,
            year: 2026,
            month: START_DAY,
            day: START_DAY,
        });
        AVAILABLE_CALENDARS.add(calendarId);
    } catch {
        UNAVAILABLE_CALENDARS.add(calendarId);
        const value = input ?? canonical;
        throw new Error(
            `Unsupported rscale: ${value} (calendar backend is not available in this runtime)`,
        );
    }
}

/**
 * Build recurrence month metadata from a Temporal month code.
 * @param monthCode Temporal month code.
 * @return Parsed month metadata.
 */
function buildMonthCode(monthCode: string): CalendarMonthCode {
    const cached = MONTH_CODE_CACHE.get(monthCode);
    if (cached) {
        return cached;
    }
    const match = /^M(\d+)(L)?$/i.exec(monthCode);
    if (!match) {
        throw new Error(`Unsupported Temporal monthCode: ${monthCode}`);
    }
    const resolved = {
        value: `M${pad(Number(match[1]), 2)}${match[2] ? "L" : ""}`,
        ordinal: Number(match[1]),
        isLeap: match[2] === "L",
    };
    MONTH_CODE_CACHE.set(monthCode, resolved);
    return resolved;
}

/**
 * Compare two month codes using recurrence month ordering.
 * @param left First month code.
 * @param right Second month code.
 * @return Negative/zero/positive comparison result.
 */
function compareMonthCode(
    left: CalendarMonthCode,
    right: CalendarMonthCode,
): number {
    if (left.ordinal !== right.ordinal) {
        return left.ordinal - right.ordinal;
    }
    if (left.isLeap === right.isLeap) {
        return 0;
    }
    return left.isLeap ? 1 : -1;
}

/**
 * Convert a Temporal PlainDateTime into recurrence parts.
 * @param value Temporal PlainDateTime.
 * @return Calendar-local recurrence parts.
 */
function fromPlainDateTime(value: PlainDateTime): CalendarDateTimeParts {
    return {
        year: value.year,
        monthCode: buildMonthCode(value.monthCode),
        day: value.day,
        hour: value.hour,
        minute: value.minute,
        second: value.second,
    };
}

/**
 * Convert a Temporal ZonedDateTime into recurrence parts.
 * @param value Temporal ZonedDateTime.
 * @return Calendar-local recurrence parts.
 */
function fromZonedDateTime(value: ZonedDateTime): CalendarDateTimeParts {
    return {
        year: value.year,
        monthCode: buildMonthCode(value.monthCode),
        day: value.day,
        hour: value.hour,
        minute: value.minute,
        second: value.second,
    };
}

/**
 * Format an ISO-like Temporal date-time into LocalDateTime text.
 * @param value Temporal date-time value.
 * @return LocalDateTime string.
 */
function formatIsoLike(value: PlainDateTime | ZonedDateTime): string {
    return `${pad(value.year, 4)}-${pad(value.month, 2)}-${pad(value.day, 2)}T${pad(value.hour, 2)}:${pad(value.minute, 2)}:${pad(value.second, 2)}`;
}

function dateCacheKey(value: CalendarDateParts): string {
    return `${value.year}:${value.monthCode.value}:${value.day}`;
}

function dateTimeCacheKey(value: CalendarDateTimeParts): string {
    return `${dateCacheKey(value)}:${value.hour}:${value.minute}:${value.second}`;
}
