import type { RecurrenceRule } from "../types.js";
import type { CalendarBackend, DateTime, DayOfWeek } from "./types.js";
import {
    filterDateCandidates,
    generateDateCandidates,
    sortDateCandidates,
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
    backend: CalendarBackend,
    firstDay: DayOfWeek,
    skip: string,
    timeZone?: string | null,
): string[] {
    const dateCandidates = generateDateCandidates(
        periodStart,
        rule,
        backend,
        firstDay,
        skip,
    );
    const filteredDates = sortDateCandidates(
        filterDateCandidates(
            dateCandidates,
            rule,
            periodStart,
            backend,
            firstDay,
            skip,
        ),
        backend,
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
                    const dt = {
                        year: date.year,
                        monthCode: date.monthCode,
                        day: date.day,
                        hour,
                        minute,
                        second,
                    };
                    result.push(backend.toGregorianLocal(dt, timeZone));
                }
            }
        }
    }

    return result;
}
