import { EMPTY_STRING } from "./constants.js";

/**
 * Convert seconds to an ISO 8601 duration string.
 * @param totalSeconds Total seconds to encode.
 * @return ISO 8601 duration string.
 */
export function durationFromSeconds(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(clamped / 86400);
  let remaining = clamped % 86400;
  const hours = Math.floor(remaining / 3600);
  remaining %= 3600;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  const datePart = days > 0 ? `${days}D` : "";
  const timeParts: string[] = [];
  if (hours > 0) timeParts.push(`${hours}H`);
  if (minutes > 0) timeParts.push(`${minutes}M`);
  if (seconds > 0 || (datePart === EMPTY_STRING && timeParts.length === 0)) {
    timeParts.push(`${seconds}S`);
  }
  const timePart = timeParts.length > 0 ? `T${timeParts.join("")}` : "";
  return `P${datePart}${timePart}`;
}

export const Duration = {
  /**
   * Convert seconds to a duration string.
   * @param value Total seconds.
   * @return ISO 8601 duration string.
   */
  seconds(value: number): string {
    return durationFromSeconds(value);
  },
  /**
   * Convert minutes to a duration string.
   * @param value Total minutes.
   * @return ISO 8601 duration string.
   */
  minutes(value: number): string {
    return durationFromSeconds(value * 60);
  },
  /**
   * Convert hours to a duration string.
   * @param value Total hours.
   * @return ISO 8601 duration string.
   */
  hours(value: number): string {
    return durationFromSeconds(value * 3600);
  },
  /**
   * Convert days to a duration string.
   * @param value Total days.
   * @return ISO 8601 duration string.
   */
  days(value: number): string {
    return durationFromSeconds(value * 86400);
  },
  /**
   * Build a duration string from component parts.
   * @param parts Day/hour/minute/second parts.
   * @return ISO 8601 duration string.
   */
  from(parts: { days?: number; hours?: number; minutes?: number; seconds?: number }): string {
    const seconds = (parts.days ?? 0) * 86400 +
      (parts.hours ?? 0) * 3600 +
      (parts.minutes ?? 0) * 60 +
      (parts.seconds ?? 0);
    return durationFromSeconds(seconds);
  },
};
