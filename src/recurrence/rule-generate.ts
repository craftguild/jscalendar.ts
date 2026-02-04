import type { RecurrenceRule } from "../types.js";
import type { DateTime, DayOfWeek } from "./types.js";
import { formatLocalDateTime } from "./date-utils.js";
import {
    filterDateCandidates,
    generateDateCandidates,
} from "./rule-candidates.js";

/**
 * Generate date-time strings for the current period using rule filters.
 * @param periodStart Start of the current recurrence period.
 * @param rule Normalized recurrence rule.
 * @param firstDay First day of the week for weekly calculations.
 * @param skip Skip policy for invalid month days.
 * @return Date-time strings for this period.
 */
export function generateDateTimes(
    periodStart: DateTime,
    rule: RecurrenceRule,
    firstDay: DayOfWeek,
    skip: string,
): string[] {
    const dateCandidates = generateDateCandidates(
        periodStart,
        rule,
        firstDay,
        skip,
    );
    const filteredDates = filterDateCandidates(
        dateCandidates,
        rule,
        periodStart,
        firstDay,
        skip,
    );

    const hours =
        rule.byHour && rule.byHour.length > 0
            ? rule.byHour
            : [periodStart.hour];
    const minutes =
        rule.byMinute && rule.byMinute.length > 0
            ? rule.byMinute
            : [periodStart.minute];
    const seconds =
        rule.bySecond && rule.bySecond.length > 0
            ? rule.bySecond
            : [periodStart.second];

    const result: string[] = [];
    for (const date of filteredDates) {
        for (const hour of hours) {
            for (const minute of minutes) {
                for (const second of seconds) {
                    const dt = formatLocalDateTime({
                        year: date.year,
                        month: date.month,
                        day: date.day,
                        hour,
                        minute,
                        second,
                    });
                    result.push(dt);
                }
            }
        }
    }

    return result;
}
