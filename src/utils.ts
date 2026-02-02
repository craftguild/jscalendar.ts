import type { Duration, UTCDateTime } from "./types.js";
import { format } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export function nowUtc(): UTCDateTime {
  return normalizeUtcDateTime(new Date().toISOString());
}

export function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  throw new Error("structuredClone is not available in this environment");
}

export function isUtcDateTime(value: string): boolean {
  return /Z$/.test(value);
}

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

export function localDateTimeFromDate(value: Date): string {
  return format(value, "yyyy-MM-dd'T'HH:mm:ss");
}

export function dateTimeInTimeZone(value: Date, timeZone: string): string {
  return formatInTimeZone(value, timeZone, "yyyy-MM-dd'T'HH:mm:ss");
}

export function localDateTimeToUtcDate(value: string, timeZone: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(value);
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
