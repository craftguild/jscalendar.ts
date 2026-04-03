import type { CalendarMonthCode } from "./calendar/types.js";

const MONTH_TOKEN = /^[1-9][0-9]*L?$/i;

/**
 * Parse a BYMONTH token into recurrence month metadata.
 * @param value BYMONTH token string.
 * @return Parsed month token.
 */
export function parseMonthToken(value: string): CalendarMonthCode {
    if (!MONTH_TOKEN.test(value)) {
        throw new Error(`Invalid BYMONTH token: ${value}`);
    }
    const normalized = value.toUpperCase();
    const isLeap = normalized.endsWith("L");
    const ordinalText = isLeap ? normalized.slice(0, -1) : normalized;
    const ordinal = Number(ordinalText);
    return {
        value: `M${ordinalText.padStart(2, "0")}${isLeap ? "L" : ""}`,
        ordinal,
        isLeap,
    };
}

/**
 * Format a parsed month token back into RFC 7529 BYMONTH syntax.
 * @param value Parsed month token.
 * @return RFC 7529 BYMONTH token.
 */
export function formatMonthToken(value: CalendarMonthCode): string {
    return `${value.ordinal}${value.isLeap ? "L" : ""}`;
}
