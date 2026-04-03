import type { RecurrenceRule } from "../types.js";
import {
    FREQ_DAILY,
    FREQ_HOURLY,
    FREQ_MINUTELY,
    FREQ_MONTHLY,
    FREQ_SECONDLY,
    FREQ_WEEKLY,
    FREQ_YEARLY,
    SKIP_BACKWARD,
    SKIP_FORWARD,
    SKIP_OMIT,
} from "./constants.js";
import {
    matchesByDay,
    matchesByMonthDay,
    matchesByWeekNo,
    matchesByYearDay,
} from "./rule-matchers.js";

import { parseMonthToken } from "./month-tokens.js";
import type {
    CalendarBackend,
    CalendarDateParts,
    CalendarMonthCode,
    DateCandidate,
    DateTime,
    DayOfWeek,
} from "./types.js";
import { pad } from "./date-utils.js";

const WEEK_ORDER: DayOfWeek[] = ["mo", "tu", "we", "th", "fr", "sa", "su"];

/**
 * Build candidate dates for the current recurrence period.
 * @param periodStart Start of the current recurrence period.
 * @param rule Normalized recurrence rule.
 * @param firstDay First day of the week for weekly calculations.
 * @param skip Skip policy for invalid month days.
 * @return Candidate dates for further filtering.
 */
export function generateDateCandidates(
    periodStart: DateTime,
    rule: RecurrenceRule,
    backend: CalendarBackend,
    firstDay: DayOfWeek,
    skip: string,
): DateCandidate[] {
    const byMonthDay = rule.byMonthDay?.filter((day) => day !== 0);

    if (rule.frequency === FREQ_YEARLY) {
        const months = resolveMonthsForGeneration(
            periodStart.year,
            rule,
            backend,
            skip,
        );
        if (rule.byYearDay && rule.byYearDay.length > 0) {
            return buildYearDayCandidates(periodStart.year, rule, backend);
        }
        if (rule.byWeekNo && rule.byWeekNo.length > 0) {
            return buildWeekNumberCandidates(
                periodStart.year,
                rule,
                backend,
                firstDay,
            );
        }
        if (canDirectlyGenerateNthByDay(rule)) {
            return buildYearlyNthByDayCandidates(
                periodStart.year,
                rule,
                backend,
                months,
            );
        }
        if (byMonthDay && byMonthDay.length > 0) {
            return months.flatMap((monthCode) =>
                buildMonthDayCandidates(
                    periodStart.year,
                    monthCode,
                    byMonthDay,
                    backend,
                ),
            );
        }
        if (rule.byDay && rule.byDay.length > 0) {
            return buildYearlyByDayCandidates(
                periodStart.year,
                rule,
                backend,
                months,
            );
        }
        return buildDefaultYearlyCandidates(periodStart.year, months);
    }

    if (rule.frequency === FREQ_MONTHLY) {
        if (canDirectlyGenerateNthByDay(rule)) {
            return buildMonthlyNthByDayCandidates(periodStart, rule, backend);
        }
        if (byMonthDay && byMonthDay.length > 0) {
            return buildMonthDayCandidates(
                periodStart.year,
                periodStart.monthCode,
                byMonthDay,
                backend,
            );
        }
        if (rule.byDay && rule.byDay.length > 0) {
            return buildMonthlyByDayCandidates(periodStart, rule, backend);
        }
        return buildDefaultMonthlyCandidates(periodStart);
    }

    if (rule.frequency === FREQ_WEEKLY) {
        const result: DateCandidate[] = [];
        let cursor = startOfWeek(periodStart, firstDay, backend);
        for (let i = 0; i < 7; i += 1) {
            result.push({
                year: cursor.year,
                monthCode: cursor.monthCode,
                day: cursor.day,
                valid: true,
            });
            cursor = backend.addDays(cursor, 1);
        }
        return result;
    }

    if (rule.frequency === FREQ_DAILY) {
        return [buildSingleCandidate(periodStart)];
    }

    if (
        rule.frequency === FREQ_HOURLY ||
        rule.frequency === FREQ_MINUTELY ||
        rule.frequency === FREQ_SECONDLY
    ) {
        return [buildSingleCandidate(periodStart)];
    }

    return [];
}

/**
 * Apply BY* filters and skip behavior to candidate dates.
 * @param candidates Candidate dates for the period.
 * @param rule Normalized recurrence rule.
 * @param periodStart Start of the current recurrence period.
 * @param firstDay First day of the week for weekly calculations.
 * @param skip Skip policy for invalid month days.
 * @return Filtered candidate dates.
 */
export function filterDateCandidates(
    candidates: DateCandidate[],
    rule: RecurrenceRule,
    periodStart: DateTime,
    backend: CalendarBackend,
    firstDay: DayOfWeek,
    skip: string,
): DateCandidate[] {
    let result = candidates;
    const matcherCache = {
        nthPeriodDates: new Map<string, CalendarDateParts[]>(),
        weeksInYear: new Map<string, number>(),
    };

    if (rule.byMonth && rule.byMonth.length > 0) {
        const rawMonths = rule.byMonth;
        const months = rawMonths.map(parseMonthToken);
        const resolvedMonthsByYear = new Map<
            number,
            Array<{ year: number; monthCode: CalendarMonthCode }>
        >();
        result = result.filter((d) =>
            getResolvedMonthsForYear(
                d.year,
                months,
                backend,
                skip,
                rawMonths,
                resolvedMonthsByYear,
            ).some(
                (month) =>
                    month.year === d.year &&
                    month.monthCode.ordinal === d.monthCode.ordinal &&
                    month.monthCode.isLeap === d.monthCode.isLeap,
            ),
        );
    }

    if (rule.byWeekNo && rule.byWeekNo.length > 0) {
        const byWeekNo = rule.byWeekNo.filter((d) => d !== 0);
        result = result.filter(
            (d) =>
                d.valid &&
                matchesByWeekNo(d, byWeekNo, backend, firstDay, matcherCache),
        );
    }

    if (rule.byYearDay && rule.byYearDay.length > 0) {
        const byYearDay = rule.byYearDay.filter((d) => d !== 0);
        result = result.filter(
            (d) => d.valid && matchesByYearDay(d, byYearDay, backend),
        );
    }

    if (rule.byMonthDay && rule.byMonthDay.length > 0) {
        const byMonthDay = rule.byMonthDay.filter((d) => d !== 0);
        result = result.filter((d) =>
            matchesByMonthDay(d, byMonthDay, backend),
        );
    }

    if (skip !== SKIP_OMIT && rule.byMonthDay && rule.byMonthDay.length > 0) {
        result = adjustInvalidMonthDays(result, backend, skip);
    } else {
        result = result.filter((d) => d.valid);
    }

    const byDay = rule.byDay;
    if (byDay && byDay.length > 0) {
        result = result.filter((d) =>
            matchesByDay(
                d,
                byDay,
                rule.frequency,
                periodStart,
                backend,
                firstDay,
                matcherCache,
            ),
        );
    }

    return result;
}

/**
 * Resolve BYMONTH tokens into valid months after applying month skip rules.
 * @param year Active calendar year for the recurrence period.
 * @param months Parsed BYMONTH tokens.
 * @param backend Calendar backend.
 * @param skip Skip policy for invalid months.
 * @param rawMonths Original BYMONTH values for error reporting.
 * @return Valid months to keep for the current period.
 */
function resolveByMonthFilter(
    year: number,
    months: ReturnType<typeof parseMonthToken>[],
    backend: CalendarBackend,
    skip: string,
    rawMonths: string[],
): Array<{ year: number; monthCode: CalendarMonthCode }> {
    const resolved = new Map<
        string,
        { year: number; monthCode: CalendarMonthCode }
    >();

    for (const month of months) {
        const direct = backend.resolveMonthToken(year, month);
        if (direct) {
            resolved.set(`${year}:${direct.value}`, {
                year,
                monthCode: direct,
            });
            continue;
        }
        if (skip === SKIP_OMIT) {
            continue;
        }

        const direction = skip === SKIP_FORWARD ? "forward" : "backward";
        const adjusted = backend.adjustInvalidMonth(year, month, direction);
        if (!adjusted) {
            throw new Error(
                `Invalid recurrence rule for rscale ${backend.rscale}: BYMONTH=${rawMonths.join(",")}`,
            );
        }
        resolved.set(`${adjusted.year}:${adjusted.monthCode.value}`, adjusted);
    }

    return Array.from(resolved.values());
}

/**
 * Memoize BYMONTH resolution per candidate year.
 * @param year Candidate year.
 * @param months Parsed BYMONTH tokens.
 * @param backend Calendar backend.
 * @param skip Skip policy for invalid months.
 * @param rawMonths Original BYMONTH values.
 * @param resolvedMonthsByYear Year-scoped cache.
 * @return Resolved month list for the year.
 */
function getResolvedMonthsForYear(
    year: number,
    months: ReturnType<typeof parseMonthToken>[],
    backend: CalendarBackend,
    skip: string,
    rawMonths: string[],
    resolvedMonthsByYear: Map<
        number,
        Array<{ year: number; monthCode: CalendarMonthCode }>
    >,
): Array<{ year: number; monthCode: CalendarMonthCode }> {
    const cached = resolvedMonthsByYear.get(year);
    if (cached) {
        return cached;
    }
    const resolved = resolveByMonthFilter(
        year,
        months,
        backend,
        skip,
        rawMonths,
    );
    resolvedMonthsByYear.set(year, resolved);
    return resolved;
}

/**
 * Resolve the months to generate for a yearly period.
 * @param year Active calendar year.
 * @param rule Normalized recurrence rule.
 * @param backend Calendar backend.
 * @param skip Skip policy for invalid months.
 * @return Months to generate for the year.
 */
function resolveMonthsForGeneration(
    year: number,
    rule: RecurrenceRule,
    backend: CalendarBackend,
    skip: string,
): CalendarMonthCode[] {
    if (!rule.byMonth || rule.byMonth.length === 0) {
        return backend.monthsInYear(year);
    }

    return resolveByMonthFilter(
        year,
        rule.byMonth.map(parseMonthToken),
        backend,
        skip,
        rule.byMonth,
    ).map((entry) => entry.monthCode);
}

/**
 * Build direct yearly candidates from BYYEARDAY values.
 * @param year Active calendar year.
 * @param rule Normalized recurrence rule.
 * @param backend Calendar backend.
 * @return Direct yearly candidates.
 */
function buildYearDayCandidates(
    year: number,
    rule: RecurrenceRule,
    backend: CalendarBackend,
): DateCandidate[] {
    const months = backend.monthsInYear(year);
    const firstMonth = months[0];
    if (!firstMonth) {
        return [];
    }

    const yearStart: DateTime = {
        year,
        monthCode: firstMonth,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
    };
    const daysInYear = backend.daysInYear(year);
    const deduped = new Map<string, DateCandidate>();

    for (const value of rule.byYearDay ?? []) {
        if (value === 0) {
            continue;
        }
        const offset = value > 0 ? value - 1 : daysInYear + value;
        if (offset < 0 || offset >= daysInYear) {
            continue;
        }
        const resolved = backend.addDays(yearStart, offset);
        const candidate = buildSingleCandidate(resolved);
        deduped.set(candidateKey(candidate), candidate);
    }

    return Array.from(deduped.values());
}

/**
 * Build direct yearly candidates from BYWEEKNO values.
 * @param year Active calendar year.
 * @param rule Normalized recurrence rule.
 * @param backend Calendar backend.
 * @param firstDay First day of week.
 * @return Direct yearly candidates.
 */
function buildWeekNumberCandidates(
    year: number,
    rule: RecurrenceRule,
    backend: CalendarBackend,
    firstDay: DayOfWeek,
): DateCandidate[] {
    const totalWeeks = backend.weeksInYear(year, firstDay);
    const start = backend.week1Start(year, firstDay);
    const week1Start: DateTime = {
        year: start.year,
        monthCode: start.monthCode,
        day: start.day,
        hour: 0,
        minute: 0,
        second: 0,
    };
    const deduped = new Map<string, DateCandidate>();

    for (const value of rule.byWeekNo ?? []) {
        if (value === 0) {
            continue;
        }
        const weekNumber = value > 0 ? value : totalWeeks + value + 1;
        if (weekNumber < 1 || weekNumber > totalWeeks) {
            continue;
        }
        const weekStart = backend.addDays(week1Start, (weekNumber - 1) * 7);
        if (rule.byDay && rule.byDay.length > 0) {
            for (const day of rule.byDay) {
                const resolved = backend.addDays(
                    weekStart,
                    weekdayOffset(day.day, firstDay),
                );
                if (resolved.year !== year) {
                    continue;
                }
                const candidate = buildSingleCandidate(resolved);
                deduped.set(candidateKey(candidate), candidate);
            }
            continue;
        }

        for (let offset = 0; offset < 7; offset += 1) {
            const resolved = backend.addDays(weekStart, offset);
            if (resolved.year !== year) {
                continue;
            }
            const candidate = buildSingleCandidate(resolved);
            deduped.set(candidateKey(candidate), candidate);
        }
    }

    return Array.from(deduped.values());
}

/**
 * Shift invalid month-day candidates using the skip policy.
 * @param candidates Candidate dates that may include invalid month days.
 * @param skip Skip policy for invalid month days.
 * @return Candidates with invalid days adjusted or removed.
 */
function adjustInvalidMonthDays(
    candidates: DateCandidate[],
    backend: CalendarBackend,
    skip: string,
): DateCandidate[] {
    const adjusted: DateCandidate[] = [];
    for (const candidate of candidates) {
        if (candidate.valid) {
            adjusted.push(candidate);
            continue;
        }
        const monthStart = {
            year: candidate.year,
            monthCode: candidate.monthCode,
            day: 1,
            hour: 0,
            minute: 0,
            second: 0,
        };
        const monthLength = backend.daysInMonth({
            year: candidate.year,
            monthCode: candidate.monthCode,
            day: 1,
        });
        if (skip === SKIP_FORWARD) {
            if (candidate.day > monthLength) {
                const next = backend.add(monthStart, FREQ_MONTHLY, 1, "mo");
                adjusted.push({
                    year: next.year,
                    monthCode: next.monthCode,
                    day: 1,
                    valid: true,
                });
            } else {
                const previous = backend.addDays(monthStart, -1);
                adjusted.push({
                    year: previous.year,
                    monthCode: previous.monthCode,
                    day: previous.day,
                    valid: true,
                });
            }
        } else if (skip === SKIP_BACKWARD) {
            adjusted.push({
                year: candidate.year,
                monthCode: candidate.monthCode,
                day: candidate.day > monthLength ? monthLength : 1,
                valid: true,
            });
        }
    }

    const deduped = new Map<string, DateCandidate>();
    for (const candidate of adjusted) {
        const key = `${pad(candidate.year, 4)}-${candidate.monthCode.value}-${pad(candidate.day, 2)}`;
        if (!deduped.has(key)) {
            deduped.set(key, candidate);
        }
    }
    return Array.from(deduped.values());
}

/**
 * Build candidates from explicit BYMONTHDAY values, including invalid overflow values.
 * @param year Candidate year.
 * @param monthCode Candidate month.
 * @param byMonthDay Requested BYMONTHDAY values.
 * @param backend Calendar backend.
 * @return Candidate dates for those requested month days.
 */
function buildMonthDayCandidates(
    year: number,
    monthCode: CalendarMonthCode,
    byMonthDay: number[],
    backend: CalendarBackend,
): DateCandidate[] {
    const monthLength = backend.daysInMonth({
        year,
        monthCode,
        day: 1,
    });

    return byMonthDay.map((requestedDay) => {
        const day =
            requestedDay > 0 ? requestedDay : monthLength + requestedDay + 1;
        return {
            year,
            monthCode,
            day,
            valid: day >= 1 && day <= monthLength,
        };
    });
}

/**
 * Check whether BYDAY nth-of-period entries can be generated directly.
 * @param rule Normalized recurrence rule.
 * @return True when direct candidate generation is safe.
 */
function canDirectlyGenerateNthByDay(rule: RecurrenceRule): boolean {
    if (rule.bySetPosition && rule.bySetPosition.length > 0) {
        return false;
    }
    if (!rule.byDay || rule.byDay.length === 0) {
        return false;
    }
    return rule.byDay.every((entry) => entry.nthOfPeriod !== undefined);
}

/**
 * Build yearly candidates directly for nth-of-period BYDAY rules.
 * @param year Calendar year.
 * @param rule Normalized recurrence rule.
 * @param backend Calendar backend.
 * @return Matching yearly date candidates.
 */
function buildYearlyNthByDayCandidates(
    year: number,
    rule: RecurrenceRule,
    backend: CalendarBackend,
    months: CalendarMonthCode[],
): DateCandidate[] {
    const buckets = createWeekdayBuckets();

    for (const monthCode of months) {
        const monthStart = {
            year,
            monthCode,
            day: 1,
        };
        const days = backend.daysInMonth(monthStart);
        for (let day = 1; day <= days; day += 1) {
            const candidate = {
                year,
                monthCode,
                day,
                valid: true,
            };
            buckets[backend.dayOfWeek(candidate)].push(candidate);
        }
    }

    return selectNthByDayCandidates(rule, buckets);
}

/**
 * Build direct yearly candidates from BYDAY rules without nth-of-period values.
 * @param year Active calendar year.
 * @param rule Normalized recurrence rule.
 * @param backend Calendar backend.
 * @param months Months to generate.
 * @return Direct yearly candidates.
 */
function buildYearlyByDayCandidates(
    year: number,
    rule: RecurrenceRule,
    backend: CalendarBackend,
    months: CalendarMonthCode[],
): DateCandidate[] {
    const deduped = new Map<string, DateCandidate>();

    for (const monthCode of months) {
        const monthStart = {
            year,
            monthCode,
            day: 1,
        };
        const days = backend.daysInMonth(monthStart);
        for (let day = 1; day <= days; day += 1) {
            const candidate: DateCandidate = {
                year,
                monthCode,
                day,
                valid: true,
            };
            if (
                (rule.byDay ?? []).some(
                    (entry) => entry.day === backend.dayOfWeek(candidate),
                )
            ) {
                deduped.set(candidateKey(candidate), candidate);
            }
        }
    }

    return Array.from(deduped.values());
}

/**
 * Build monthly candidates directly for nth-of-period BYDAY rules.
 * @param periodStart Start of the active recurrence period.
 * @param rule Normalized recurrence rule.
 * @param backend Calendar backend.
 * @return Matching monthly date candidates.
 */
function buildMonthlyNthByDayCandidates(
    periodStart: DateTime,
    rule: RecurrenceRule,
    backend: CalendarBackend,
): DateCandidate[] {
    const buckets = createWeekdayBuckets();
    const days = backend.daysInMonth(periodStart);

    for (let day = 1; day <= days; day += 1) {
        const candidate = {
            year: periodStart.year,
            monthCode: periodStart.monthCode,
            day,
            valid: true,
        };
        buckets[backend.dayOfWeek(candidate)].push(candidate);
    }

    return selectNthByDayCandidates(rule, buckets);
}

/**
 * Build direct monthly candidates from BYDAY rules without nth-of-period values.
 * @param periodStart Start of the active recurrence period.
 * @param rule Normalized recurrence rule.
 * @param backend Calendar backend.
 * @return Direct monthly candidates.
 */
function buildMonthlyByDayCandidates(
    periodStart: DateTime,
    rule: RecurrenceRule,
    backend: CalendarBackend,
): DateCandidate[] {
    const deduped = new Map<string, DateCandidate>();
    const days = backend.daysInMonth(periodStart);

    for (let day = 1; day <= days; day += 1) {
        const candidate: DateCandidate = {
            year: periodStart.year,
            monthCode: periodStart.monthCode,
            day,
            valid: true,
        };
        if (
            (rule.byDay ?? []).some(
                (entry) => entry.day === backend.dayOfWeek(candidate),
            )
        ) {
            deduped.set(candidateKey(candidate), candidate);
        }
    }

    return Array.from(deduped.values());
}

/**
 * Select concrete candidates from weekday buckets and nth-of-period rules.
 * @param rule Normalized recurrence rule.
 * @param buckets Candidates grouped by weekday.
 * @return Deduplicated candidate list.
 */
function selectNthByDayCandidates(
    rule: RecurrenceRule,
    buckets: Record<DayOfWeek, DateCandidate[]>,
): DateCandidate[] {
    const deduped = new Map<string, DateCandidate>();

    for (const entry of rule.byDay ?? []) {
        const nth = entry.nthOfPeriod;
        if (nth === undefined) {
            continue;
        }
        const matches = buckets[entry.day];
        const index = nth > 0 ? nth - 1 : matches.length + nth;
        if (index < 0 || index >= matches.length) {
            continue;
        }
        const candidate = matches[index];
        if (!candidate) {
            continue;
        }
        deduped.set(candidateKey(candidate), candidate);
    }

    return Array.from(deduped.values());
}

/**
 * Create empty weekday buckets.
 * @return Weekday buckets keyed by two-letter weekday code.
 */
function createWeekdayBuckets(): Record<DayOfWeek, DateCandidate[]> {
    return {
        mo: [],
        tu: [],
        we: [],
        th: [],
        fr: [],
        sa: [],
        su: [],
    };
}

/**
 * Build a stable key for candidate deduplication.
 * @param candidate Candidate date.
 * @return Stable candidate key.
 */
function candidateKey(candidate: DateCandidate): string {
    return `${pad(candidate.year, 4)}-${candidate.monthCode.value}-${pad(candidate.day, 2)}`;
}

/**
 * Build a single valid candidate from calendar date-time parts.
 * @param value Calendar date-time parts.
 * @return Single valid candidate.
 */
function buildSingleCandidate(value: DateTime): DateCandidate {
    return {
        year: value.year,
        monthCode: value.monthCode,
        day: value.day,
        valid: true,
    };
}

/**
 * Build the default monthly candidate.
 * @param periodStart Start of the active recurrence period.
 * @return Single monthly candidate.
 */
function buildDefaultMonthlyCandidates(periodStart: DateTime): DateCandidate[] {
    return [buildSingleCandidate(periodStart)];
}

/**
 * Sort candidates in calendar order before time expansion.
 * @param candidates Candidate dates to sort.
 * @param backend Calendar backend.
 * @return Sorted candidate dates.
 */
export function sortDateCandidates(
    candidates: DateCandidate[],
    backend: CalendarBackend,
): DateCandidate[] {
    if (candidates.length < 2) {
        return candidates;
    }

    const monthOrderByYear = new Map<number, Map<string, number>>();
    const sorted = [...candidates];
    sorted.sort((left, right) =>
        compareCandidates(left, right, backend, monthOrderByYear),
    );
    return sorted;
}

/**
 * Compare two candidates using calendar order.
 * @param left First candidate.
 * @param right Second candidate.
 * @param backend Calendar backend.
 * @param monthOrderByYear Cached month ordering by year.
 * @return Negative/zero/positive comparison result.
 */
function compareCandidates(
    left: DateCandidate,
    right: DateCandidate,
    backend: CalendarBackend,
    monthOrderByYear: Map<number, Map<string, number>>,
): number {
    if (left.year !== right.year) {
        return left.year - right.year;
    }

    const leftMonth = monthOrder(
        left.year,
        left.monthCode.value,
        backend,
        monthOrderByYear,
    );
    const rightMonth = monthOrder(
        right.year,
        right.monthCode.value,
        backend,
        monthOrderByYear,
    );
    if (leftMonth !== rightMonth) {
        return leftMonth - rightMonth;
    }
    return left.day - right.day;
}

/**
 * Resolve month order for a candidate year.
 * @param year Candidate year.
 * @param monthCode Month code string.
 * @param backend Calendar backend.
 * @param monthOrderByYear Cached month ordering by year.
 * @return Zero-based month index.
 */
function monthOrder(
    year: number,
    monthCode: string,
    backend: CalendarBackend,
    monthOrderByYear: Map<number, Map<string, number>>,
): number {
    let monthOrder = monthOrderByYear.get(year);
    if (!monthOrder) {
        monthOrder = new Map<string, number>();
        for (const [index, month] of backend.monthsInYear(year).entries()) {
            monthOrder.set(month.value, index);
        }
        monthOrderByYear.set(year, monthOrder);
    }
    return monthOrder.get(monthCode) ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Build the default yearly candidate at the first generated month.
 * @param year Active calendar year.
 * @param months Months to generate.
 * @return Single yearly candidate when available.
 */
function buildDefaultYearlyCandidates(
    year: number,
    months: CalendarMonthCode[],
): DateCandidate[] {
    const monthCode = months[0];
    if (!monthCode) {
        return [];
    }
    return [
        {
            year,
            monthCode,
            day: 1,
            valid: true,
        },
    ];
}

/**
 * Find the start of the recurrence week for a calendar-local date.
 * @param value Current period start.
 * @param firstDay First day of week.
 * @param backend Calendar backend.
 * @return Start of week in the active calendar.
 */
function startOfWeek(
    value: DateTime,
    firstDay: DayOfWeek,
    backend: CalendarBackend,
): DateTime {
    const dayIndex = WEEK_ORDER.indexOf(backend.dayOfWeek(value));
    const firstDayIndex = WEEK_ORDER.indexOf(firstDay);
    const offset =
        (dayIndex - firstDayIndex + WEEK_ORDER.length) % WEEK_ORDER.length;
    return backend.addDays(value, -offset);
}

/**
 * Compute the offset from the configured week start to a target weekday.
 * @param day Target weekday.
 * @param firstDay First day of week.
 * @return Offset in days.
 */
function weekdayOffset(day: DayOfWeek, firstDay: DayOfWeek): number {
    return (WEEK_ORDER.indexOf(day) - WEEK_ORDER.indexOf(firstDay) + 7) % 7;
}
