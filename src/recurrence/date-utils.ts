import { Temporal } from "./calendar/temporal.js";
import type { PlainDateTime } from "./calendar/temporal.js";

/**
 * Parse local date time into structured data.
 * @param value LocalDateTime string.
 * @return Parsed date-time parts.
 */
export function parseLocalDateTime(value: string): PlainDateTime {
    return Temporal.PlainDateTime.from(value);
}

/**
 * Format local date time as string.
 * @param dt Date-time parts.
 * @return LocalDateTime string.
 */
export function formatLocalDateTime(dt: PlainDateTime): string {
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
