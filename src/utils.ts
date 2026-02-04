import type { Duration, UTCDateTime } from "./types.js";
import { format } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const TYPEOF_FUNCTION = "function";
const TYPEOF_STRING = "string";
const TYPEOF_NUMBER = "number";
const TYPEOF_BOOLEAN = "boolean";
const TYPEOF_OBJECT = "object";

export type PrimitiveLike =
    | string
    | number
    | boolean
    | object
    | null
    | undefined;

/**
 * Check whether a value is a string.
 * @param value Value to check.
 * @return True if the value is a string.
 */
export function isStringValue(value: PrimitiveLike): value is string {
    return typeof value === TYPEOF_STRING;
}

/**
 * Check whether a value is a number.
 * @param value Value to check.
 * @return True if the value is a number.
 */
export function isNumberValue(value: PrimitiveLike): value is number {
    return typeof value === TYPEOF_NUMBER;
}

/**
 * Check whether a value is a boolean.
 * @param value Value to check.
 * @return True if the value is a boolean.
 */
export function isBooleanValue(value: PrimitiveLike): value is boolean {
    return typeof value === TYPEOF_BOOLEAN;
}

/**
 * Check whether a value is a non-null object.
 * @param value Value to check.
 * @return True if the value is a non-null object.
 */
export function isObjectValue(value: PrimitiveLike): value is object {
    return value !== null && typeof value === TYPEOF_OBJECT;
}

/**
 * Get the current UTC date-time string.
 * @return Current time as UTCDateTime.
 */
export function nowUtc(): UTCDateTime {
    return normalizeUtcDateTime(new Date().toISOString());
}

/**
 * Deep-clone a value using structuredClone.
 * @param value Value to clone.
 * @return Deep clone of the input value.
 */
export function deepClone<T>(value: T): T {
    if (typeof structuredClone === TYPEOF_FUNCTION) {
        return structuredClone(value);
    }
    throw new Error("structuredClone is not available in this environment");
}

/**
 * Check if a string is a UTCDateTime with Z suffix.
 * @param value Date-time string.
 * @return True if the value ends with Z.
 */
export function isUtcDateTime(value: string): boolean {
    return /Z$/.test(value);
}

/**
 * Compare two date-time strings, returning null when incomparable.
 * @param a Date-time string A.
 * @param b Date-time string B.
 * @return -1, 0, 1, or null when formats are incompatible.
 */
export function compareDateTime(a: string, b: string): number | null {
    const aUtc = isUtcDateTime(a);
    const bUtc = isUtcDateTime(b);
    if (aUtc && bUtc) {
        const aMs = Date.parse(a);
        const bMs = Date.parse(b);
        if (Number.isNaN(aMs) || Number.isNaN(bMs)) return null;
        return aMs === bMs ? 0 : aMs < bMs ? -1 : 1;
    }
    if (!aUtc && !bUtc) {
        if (a === b) return 0;
        return a < b ? -1 : 1;
    }
    return null;
}

/**
 * Convert a duration string to milliseconds.
 * @param duration Duration string.
 * @return Milliseconds or null when invalid.
 */
export function durationToMilliseconds(duration: Duration): number | null {
    const re =
        /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;
    const match = re.exec(duration);
    if (!match) return null;
    const weeks = Number(match[1] || 0);
    const days = Number(match[2] || 0);
    const hours = Number(match[3] || 0);
    const minutes = Number(match[4] || 0);
    const seconds = Number(match[5] || 0);
    const totalSeconds =
        weeks * 7 * 24 * 60 * 60 +
        days * 24 * 60 * 60 +
        hours * 60 * 60 +
        minutes * 60 +
        seconds;
    return totalSeconds * 1000;
}

/**
 * Normalize a UTCDateTime by trimming trailing fractional zeros.
 * @param value UTCDateTime string.
 * @return Normalized UTCDateTime string.
 */
export function normalizeUtcDateTime(value: string): UTCDateTime {
    const match = value.match(/^(.*)\.(\d+)Z$/);
    if (!match) return value;
    const prefix = match[1] ?? value;
    const fraction = match[2] ?? "";
    const trimmed = fraction.replace(/0+$/, "");
    if (trimmed.length === 0) {
        return `${prefix}Z`;
    }
    return `${prefix}.${trimmed}Z`;
}

/**
 * Format a Date as LocalDateTime string.
 * @param value Date to format.
 * @return LocalDateTime string.
 */
export function localDateTimeFromDate(value: Date): string {
    return format(value, "yyyy-MM-dd'T'HH:mm:ss");
}

/**
 * Format a Date as a LocalDateTime in a target time zone.
 * @param value Date to format.
 * @param timeZone IANA time zone.
 * @return LocalDateTime string in the time zone.
 */
export function dateTimeInTimeZone(value: Date, timeZone: string): string {
    return formatInTimeZone(value, timeZone, "yyyy-MM-dd'T'HH:mm:ss");
}

/**
 * Convert LocalDateTime string to a UTC Date using a time zone.
 * @param value LocalDateTime string.
 * @param timeZone IANA time zone.
 * @return Date in UTC.
 */
export function localDateTimeToUtcDate(value: string, timeZone: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(
        value,
    );
    if (!match) {
        throw new Error(`Invalid LocalDateTime: ${value}`);
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6]);
    const local = new Date(year, month - 1, day, hour, minute, second);
    return fromZonedTime(local, timeZone);
}
