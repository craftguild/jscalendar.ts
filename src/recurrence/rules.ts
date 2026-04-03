import type { RecurrenceRule, TimeZoneId } from "../types.js";
import { SKIP_OMIT } from "./constants.js";
import { createCalendarBackendOrThrow } from "./calendar/temporal-backend.js";
import type { DayOfWeek } from "./types.js";
import { parseLocalDateTime } from "./date-utils.js";
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
    parseLocalDateTime(anchor);
    const backend = createCalendarBackendOrThrow(rule.rscale);
    const start = backend.fromGregorianLocal(anchor, timeZone ?? null);
    const normalized = normalizeRule(rule, start, backend);
    const interval = normalized.interval ?? 1;
    const until = normalized.until;
    const count = normalized.count ?? Infinity;
    const skip = normalized.skip ?? SKIP_OMIT;
    const firstDay: DayOfWeek = normalized.firstDayOfWeek ?? "mo";

    const results: string[] = [];
    let generated = 0;
    let cursor = start;
    const anchorValue = anchor;
    const usesBySetPosition = Boolean(
        normalized.bySetPosition && normalized.bySetPosition.length > 0,
    );

    while (generated < count) {
        const generatedCandidates = generateDateTimes(
            cursor,
            normalized,
            backend,
            firstDay,
            skip,
            timeZone ?? null,
        );
        const candidates = generatedCandidates;
        let filtered = candidates;
        if (usesBySetPosition && normalized.bySetPosition) {
            filtered = applyBySetPos(candidates, normalized.bySetPosition);
        }
        const isAnchorPeriod = backend.compareDate(cursor, start) === 0;
        const cursorKey = backend.toGregorianLocal(cursor, timeZone ?? null);

        for (const dt of filtered) {
            if (isAnchorPeriod && dt < anchorValue) {
                continue;
            }
            generated += 1;
            if (generated > count) break;
            if (until && dt > until) return results;
            if (dt >= fromLocal && dt <= toLocal) {
                results.push(dt);
            }
        }

        if (until && cursorKey > until) break;
        if (generated >= count) break;
        if (cursorKey > toLocal) break;

        cursor = backend.add(cursor, normalized.frequency, interval, firstDay);
    }

    return results;
}
