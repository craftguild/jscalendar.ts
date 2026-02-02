import type { UTCDateTime } from "../types.js";
import { normalizeUtcDateTime } from "../utils.js";
import { isStringValue } from "../utils.js";
import type { DateInput } from "./types.js";

/**
 * Pad a number to two digits.
 * @param value Number to pad.
 * @return Zero-padded string.
 */
function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

/**
 * Convert a Date input to a LocalDateTime string.
 * @param value Date or LocalDateTime string.
 * @return LocalDateTime string.
 */
export function toLocalDateTime(value: DateInput): string {
  if (isStringValue(value)) return value;
  return [
    value.getFullYear().toString().padStart(4, "0"),
    "-",
    pad2(value.getMonth() + 1),
    "-",
    pad2(value.getDate()),
    "T",
    pad2(value.getHours()),
    ":",
    pad2(value.getMinutes()),
    ":",
    pad2(value.getSeconds()),
  ].join("");
}

/**
 * Convert a Date input to a UTCDateTime string.
 * @param value Date or UTCDateTime string.
 * @return UTCDateTime string.
 */
export function toUtcDateTime(value: DateInput): UTCDateTime {
  if (isStringValue(value)) return value;
  return normalizeUtcDateTime(value.toISOString());
}
