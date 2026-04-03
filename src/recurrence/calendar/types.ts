import type { RecurrenceRule } from "../../types.js";
import type { DayOfWeek } from "../types.js";
import type { PlainDate, PlainDateTime } from "./temporal.js";

/**
 * Calendar month information used by recurrence internals.
 */
export type CalendarMonthCode = {
    value: string;
    ordinal: number;
    isLeap: boolean;
};

/**
 * Calendar date parts in the active RSCALE calendar.
 */
export type CalendarDateParts = {
    year: number;
    monthCode: CalendarMonthCode;
    day: number;
};

/**
 * Calendar date-time parts in the active RSCALE calendar.
 */
export type CalendarDateTimeParts = CalendarDateParts & {
    hour: number;
    minute: number;
    second: number;
};

/**
 * Date candidate produced for recurrence filtering.
 */
export type CalendarDateCandidate = CalendarDateParts & {
    valid: boolean;
};

/**
 * Per-date cached values for a specific calendar year.
 */
export type CalendarDateScopeCache = {
    dayOfWeek?: DayOfWeek;
    dayOfYear?: number;
};

/**
 * Per-month cached values for a specific calendar year.
 */
export type CalendarMonthScopeCache = {
    daysInMonth?: number;
};

/**
 * Year-scoped lazy cache for calendar backend computations.
 */
export type CalendarYearScopeCache = {
    monthsInYear?: CalendarMonthCode[];
    daysInYear?: number;
    week1StartByFirstDay: Map<DayOfWeek, CalendarDateParts>;
    weeksInYearByFirstDay: Map<DayOfWeek, number>;
    monthTokenResolution: Map<string, CalendarMonthCode | null>;
    months: Map<string, CalendarMonthScopeCache>;
    dates: Map<string, CalendarDateScopeCache>;
};

/**
 * Backend-scoped lazy cache shared across repeated calendar operations.
 */
export type CalendarBackendScopeCache = {
    years: Map<number, CalendarYearScopeCache>;
    fromGregorianLocal: Map<string, CalendarDateTimeParts>;
    toGregorianLocal: Map<string, string>;
    plainDates: Map<string, PlainDate>;
    plainDateTimes: Map<string, PlainDateTime>;
};

/**
 * Calendar strategy used by recurrence expansion.
 */
export interface CalendarBackend {
    readonly rscale: string;

    /**
     * Convert a Gregorian local date-time string into calendar-local parts.
     * @param localDateTime Gregorian local date-time string.
     * @param timeZone Optional recurrence ID time zone.
     * @return Calendar-local date-time parts.
     */
    fromGregorianLocal(
        localDateTime: string,
        timeZone?: string | null,
    ): CalendarDateTimeParts;

    /**
     * Convert calendar-local date-time parts into a Gregorian local date-time string.
     * @param value Calendar-local date-time parts.
     * @param timeZone Optional recurrence ID time zone.
     * @return Gregorian local date-time string.
     */
    toGregorianLocal(
        value: CalendarDateTimeParts,
        timeZone?: string | null,
    ): string;

    /**
     * Add a recurrence interval using calendar-aware arithmetic.
     * @param value Current calendar-local cursor.
     * @param frequency Recurrence frequency.
     * @param amount Number of intervals to add.
     * @param firstDay First day of week for weekly intervals.
     * @return Shifted calendar-local cursor.
     */
    add(
        value: CalendarDateTimeParts,
        frequency: RecurrenceRule["frequency"],
        amount: number,
        firstDay: DayOfWeek,
    ): CalendarDateTimeParts;

    /**
     * Add days using calendar-aware arithmetic.
     * @param value Current calendar-local date-time.
     * @param amount Number of days to add.
     * @return Shifted calendar-local date-time.
     */
    addDays(
        value: CalendarDateTimeParts,
        amount: number,
    ): CalendarDateTimeParts;

    /**
     * Compare two calendar-local dates without time.
     * @param a First date.
     * @param b Second date.
     * @return Negative/zero/positive comparison result.
     */
    compareDate(a: CalendarDateParts, b: CalendarDateParts): number;

    /**
     * Get the whole-day difference between two calendar-local dates.
     * @param a Start date.
     * @param b End date.
     * @return Whole-day difference.
     */
    daysBetween(a: CalendarDateParts, b: CalendarDateParts): number;

    /**
     * Get all months in a year for the active calendar.
     * @param year Calendar year.
     * @return Months in that year.
     */
    monthsInYear(year: number): CalendarMonthCode[];

    /**
     * Resolve a BYMONTH token for a given year.
     * @param year Calendar year.
     * @param token Parsed month token.
     * @return Matching month code when available.
     */
    resolveMonthToken(
        year: number,
        token: CalendarMonthCode,
    ): CalendarMonthCode | undefined;

    /**
     * Adjust a missing BYMONTH token to the nearest valid month in the same year.
     * @param year Calendar year.
     * @param token Parsed month token.
     * @param direction Skip direction to apply.
     * @return Adjusted month reference or undefined when the token cannot be ordered.
     */
    adjustInvalidMonth(
        year: number,
        token: CalendarMonthCode,
        direction: "forward" | "backward",
    ): { year: number; monthCode: CalendarMonthCode } | undefined;

    /**
     * Get the number of days in a month.
     * @param value Calendar date parts.
     * @return Number of days in the month.
     */
    daysInMonth(value: CalendarDateParts): number;

    /**
     * Get the number of days in a year.
     * @param year Calendar year.
     * @return Number of days in the year.
     */
    daysInYear(year: number): number;

    /**
     * Get the weekday for a calendar-local date.
     * @param value Calendar date parts.
     * @return Two-letter weekday code.
     */
    dayOfWeek(value: CalendarDateParts): DayOfWeek;

    /**
     * Get the day-of-year index for a calendar-local date.
     * @param value Calendar date parts.
     * @return Day of year.
     */
    dayOfYear(value: CalendarDateParts): number;

    /**
     * Get the week number for a calendar-local date.
     * @param value Calendar date parts.
     * @param firstDay First day of week for calculations.
     * @return Week number.
     */
    weekNumber(value: CalendarDateParts, firstDay: DayOfWeek): number;

    /**
     * Get the total number of weeks in a year.
     * @param year Calendar year.
     * @param firstDay First day of week for calculations.
     * @return Total weeks in the year.
     */
    weeksInYear(year: number, firstDay: DayOfWeek): number;

    /**
     * Get the start date of week 1 for a calendar year.
     * @param year Calendar year.
     * @param firstDay First day of week for calculations.
     * @return Start date of week 1.
     */
    week1Start(year: number, firstDay: DayOfWeek): CalendarDateParts;
}
