import type { RecurrenceRule, TimeZoneId } from "../types.js";
import { RSCALE_GREGORIAN, SKIP_OMIT } from "./constants.js";
import type { DayOfWeek } from "./types.js";
import { addInterval, compareDate, formatLocalDateTime, parseLocalDateTime } from "./date-utils.js";
import { generateDateTimes } from "./rule-generate.js";
import { normalizeRule } from "./rule-normalize.js";
import { applyBySetPos } from "./rule-selectors.js";

/**
 * Expand a recurrence rule into local date-time strings within a range.
 * @param anchor Anchor LocalDateTime for the rule.
 * @param rule Recurrence rule to expand.
 * @param fromLocal Local date-time lower bound (inclusive).
 * @param toLocal Local date-time upper bound (inclusive).
 * @param includeAnchor Whether to include the anchor occurrence.
 * @param timeZone Optional time zone for range comparisons.
 * @param fromDate Optional Date lower bound (time zone-aware).
 * @param toDate Optional Date upper bound (time zone-aware).
 * @return Local date-time strings that match the rule in range order.
 */
export function expandRule(
  anchor: string,
  rule: RecurrenceRule,
  fromLocal: string,
  toLocal: string,
  includeAnchor: boolean,
  timeZone?: TimeZoneId,
  fromDate?: Date,
  toDate?: Date,
): string[] {
  if (rule.rscale && rule.rscale !== RSCALE_GREGORIAN) {
    throw new Error(`Unsupported rscale: ${rule.rscale}`);
  }
  const start = parseLocalDateTime(anchor);
  const normalized = normalizeRule(rule, start);
  const interval = normalized.interval ?? 1;
  const until = normalized.until;
  const count = normalized.count ?? Infinity;
  const skip = normalized.skip ?? SKIP_OMIT;
  const firstDay: DayOfWeek = normalized.firstDayOfWeek ?? "mo";

  const results: string[] = [];
  let generated = 0;
  let cursor = start;

  while (generated < count) {
    const candidates = generateDateTimes(cursor, normalized, firstDay, skip).sort();
    let filtered = candidates;
    if (normalized.bySetPosition && normalized.bySetPosition.length > 0) {
      filtered = applyBySetPos(filtered, normalized.bySetPosition);
    }

    for (const dt of filtered) {
      generated += 1;
      if (generated > count) break;
      if (until && dt > until) return results;
      if (dt >= fromLocal && dt <= toLocal) {
        results.push(dt);
      }
    }

    if (until && cursor && formatLocalDateTime(cursor) > until) break;
    if (generated >= count) break;
    if (cursor && compareDate(cursor, parseLocalDateTime(toLocal)) > 0) break;

    cursor = addInterval(cursor, normalized.frequency, interval, firstDay);
  }

  return results;
}
