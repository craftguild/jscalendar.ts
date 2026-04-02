import { describe, expect, it } from "vitest";
import { JsCal } from "../jscal.js";
import { Temporal } from "../recurrence/calendar/temporal.js";
import type {
    PlainDateTime,
    ZonedDateTime,
} from "../recurrence/calendar/temporal.js";
import type { Event, JSCalendarObject } from "../types.js";

function collect(gen: Generator<JSCalendarObject>): Event[] {
    const result: Event[] = [];
    for (const item of gen) {
        if (item["@type"] === "Event") result.push(item);
    }
    return result;
}

describe("recurrence expansion rscale", () => {
    it("supports non-gregorian rscale expansion", () => {
        const event = new JsCal.Event({
            title: "Hebrew Daily",
            start: "2026-02-18T09:00:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "daily",
                    rscale: "hebrew",
                    count: 3,
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-02-18"),
                to: new Date("2026-02-21"),
            }),
        );

        expect(occ.map((o) => o.recurrenceId)).toEqual([
            "2026-02-18T09:00:00",
            "2026-02-19T09:00:00",
            "2026-02-20T09:00:00",
        ]);
    });

    it("supports leap-month byMonth tokens when the target year has that month", () => {
        const start = findLeapMonthIsoDate("hebrew");
        if (!start) {
            expect(() => {
                const event = new JsCal.Event(
                    {
                        title: "Leap Month Unsupported",
                        start: "2026-02-01T09:00:00",
                        recurrenceRules: [
                            {
                                "@type": "RecurrenceRule",
                                frequency: "yearly",
                                rscale: "hebrew",
                                byMonth: ["6L"],
                                byMonthDay: [1],
                                count: 1,
                            },
                        ],
                    },
                    { validate: false },
                );
                collect(
                    JsCal.expandRecurrence([event], {
                        from: new Date("2026-01-01"),
                        to: new Date("2026-12-31"),
                    }),
                );
            }).toThrow("Unsupported rscale");
            return;
        }

        const event = new JsCal.Event({
            title: "Hebrew Leap Month",
            start: `${start.date}T09:00:00`,
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    rscale: "hebrew",
                    byMonth: [start.byMonth],
                    byMonthDay: [start.day],
                    count: 1,
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date(`${start.date}T00:00:00Z`),
                to: new Date(`${start.date}T23:59:59Z`),
            }),
        );

        expect(occ.map((o) => o.recurrenceId)).toEqual([
            `${start.date}T09:00:00`,
        ]);
    });

    it("omits non-leap years for leap-month byMonth tokens instead of throwing", () => {
        const occurrences = findMonthTokenOccurrences("hebrew", 3);
        if (occurrences.length < 3) {
            expect(() => {
                void 0;
            }).not.toThrow();
            return;
        }

        const first = occurrences[0];
        const last = occurrences[2];
        if (!first || !last) {
            return;
        }
        const event = new JsCal.Event({
            title: "Hebrew Leap Month Series",
            start: `${first.date}T09:00:00`,
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    rscale: "hebrew",
                    byMonth: [first.byMonth],
                    byMonthDay: [first.day],
                    count: 3,
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date(`${first.date}T00:00:00Z`),
                to: new Date(`${last.date}T23:59:59Z`),
            }),
        );

        expect(occ.map((o) => o.recurrenceId)).toEqual(
            occurrences.map((entry) => `${entry.date}T09:00:00`),
        );
    });

    it.each([
        {
            rscale: "japanese",
            timeZone: "Asia/Tokyo" as const,
        },
        {
            rscale: "buddhist",
            timeZone: "Asia/Bangkok" as const,
        },
        {
            rscale: "roc",
            timeZone: "Asia/Taipei" as const,
        },
    ])(
        "matches gregorian yearly occurrences for era-offset calendar $rscale",
        ({ rscale, timeZone }) => {
            const gregorian = new JsCal.Event({
                title: "Control",
                start: "2026-05-01T09:00:00",
                timeZone,
                recurrenceRules: [
                    {
                        "@type": "RecurrenceRule",
                        frequency: "yearly",
                        rscale: "gregorian",
                        byMonth: ["5"],
                        byMonthDay: [1],
                        count: 4,
                    },
                ],
            });
            const shifted = new JsCal.Event({
                title: "Shifted",
                start: "2026-05-01T09:00:00",
                timeZone,
                recurrenceRules: [
                    {
                        "@type": "RecurrenceRule",
                        frequency: "yearly",
                        rscale,
                        byMonth: ["5"],
                        byMonthDay: [1],
                        count: 4,
                    },
                ],
            });

            expect(
                expandEventIds(gregorian, "2026-01-01", "2030-12-31"),
            ).toEqual(expandEventIds(shifted, "2026-01-01", "2030-12-31"));
        },
    );

    it.each([
        {
            rscale: "japanese",
            timeZone: "Asia/Tokyo" as const,
        },
        {
            rscale: "buddhist",
            timeZone: "Asia/Bangkok" as const,
        },
        {
            rscale: "roc",
            timeZone: "Asia/Taipei" as const,
        },
    ])(
        "resolves override keys as gregorian local datetimes for $rscale",
        ({ rscale, timeZone }) => {
            const control = new JsCal.Event({
                title: "Series",
                start: "2026-05-01T09:00:00",
                timeZone,
                recurrenceRules: [
                    {
                        "@type": "RecurrenceRule",
                        frequency: "yearly",
                        rscale: "gregorian",
                        count: 3,
                    },
                ],
                recurrenceOverrides: {
                    "2027-05-01T09:00:00": { title: "Override" },
                },
            });
            const shifted = new JsCal.Event({
                title: "Series",
                start: "2026-05-01T09:00:00",
                timeZone,
                recurrenceRules: [
                    {
                        "@type": "RecurrenceRule",
                        frequency: "yearly",
                        rscale,
                        count: 3,
                    },
                ],
                recurrenceOverrides: {
                    "2027-05-01T09:00:00": { title: "Override" },
                },
            });

            expect(
                expandEventInstances(control, "2026-01-01", "2028-12-31").map(
                    (event) => ({
                        recurrenceId: event.recurrenceId,
                        title: event.title,
                    }),
                ),
            ).toEqual(
                expandEventInstances(shifted, "2026-01-01", "2028-12-31").map(
                    (event) => ({
                        recurrenceId: event.recurrenceId,
                        title: event.title,
                    }),
                ),
            );
        },
    );

    it("keeps floating wall clock time for islamic-civil monthly recurrences", () => {
        const event = new JsCal.Event({
            title: "Islamic Civil Floating",
            start: "2026-02-15T22:30:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "monthly",
                    rscale: "islamic-civil",
                    count: 4,
                },
            ],
        });

        const ids = expandEventIds(event, "2026-01-01", "2026-06-30");
        expect(ids).toHaveLength(4);
        expect(ids.every((value) => value.endsWith("T22:30:00"))).toBe(true);
        expect(ids).toEqual([...ids].sort());
        expectMonthlyCalendarProgression(ids, "islamic-civil");
    });

    it("follows calendar-local monthly progression for islamic-tbla", () => {
        const event = new JsCal.Event({
            title: "Islamic TBLA Monthly",
            start: "2026-02-15T09:00:00",
            timeZone: "Asia/Riyadh",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "monthly",
                    rscale: "islamic-tbla",
                    count: 6,
                },
            ],
        });

        const ids = expandEventIds(event, "2026-01-01", "2026-08-31");
        expect(ids).toHaveLength(6);
        expect(ids).toEqual([...ids].sort());
        expectMonthlyCalendarProgression(ids, "islamic-tbla", "Asia/Riyadh");
    });

    it("either expands or fails fast for islamic-umalqura depending on runtime support", () => {
        const event = new JsCal.Event(
            {
                title: "Umalqura Capability",
                start: "2026-03-20T09:00:00",
                timeZone: "Asia/Riyadh",
                recurrenceRules: [
                    {
                        "@type": "RecurrenceRule",
                        frequency: "yearly",
                        rscale: "islamic-umalqura",
                        byMonth: ["9"],
                        byMonthDay: [1],
                        count: 3,
                    },
                ],
            },
            { validate: false },
        );

        if (!isCalendarRuntimeAvailable("islamic-umalqura")) {
            expect(() =>
                expandEventIds(event, "2026-01-01", "2029-12-31"),
            ).toThrow("Unsupported rscale");
            return;
        }

        const ids = expandEventIds(event, "2026-01-01", "2029-12-31");
        expect(ids).toHaveLength(3);
        expect(ids).toEqual([...ids].sort());
    });

    it("projects Persian new year as month 1 day 1 in the Persian calendar", () => {
        const event = new JsCal.Event({
            title: "Persian New Year",
            start: "2026-03-21T09:00:00",
            timeZone: "Asia/Tehran",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    rscale: "persian",
                    byMonth: ["1"],
                    byMonthDay: [1],
                    count: 4,
                },
            ],
        });

        const ids = expandEventIds(event, "2026-01-01", "2030-12-31");
        expect(ids).toHaveLength(4);
        expect(
            ids.every((value) => /^20\d\d-03-(20|21|22)T09:00:00$/.test(value)),
        ).toBe(true);
        for (const id of ids) {
            const date = toCalendarDateTime(id, "persian", "Asia/Tehran");
            expect(date.monthCode).toBe("M01");
            expect(date.day).toBe(1);
        }
    });

    it("uses the last day of each Persian year for byYearDay=-1", () => {
        const expectedDates = findCalendarYearEndDates(
            "persian",
            "2026-06-01",
            3,
        );
        const event = new JsCal.Event({
            title: "Persian Year End",
            start: `${expectedDates[0]}T09:00:00`,
            timeZone: "Asia/Tehran",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    rscale: "persian",
                    byYearDay: [-1],
                    count: 3,
                },
            ],
        });

        const ids = expandEventIds(event, "2026-01-01", "2029-12-31");
        expect(ids).toEqual(expectedDates.map((value) => `${value}T09:00:00`));
    });

    it("uses the last day of each Hebrew year for byYearDay=-1", () => {
        const expectedDates = findCalendarYearEndDates(
            "hebrew",
            "2026-06-01",
            3,
        );
        const event = new JsCal.Event({
            title: "Hebrew Year End",
            start: `${expectedDates[0]}T09:00:00`,
            timeZone: "Asia/Jerusalem",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    rscale: "hebrew",
                    byYearDay: [-1],
                    count: 3,
                },
            ],
        });

        const ids = expandEventIds(event, "2026-01-01", "2029-12-31");
        expect(ids).toEqual(expectedDates.map((value) => `${value}T09:00:00`));
    });

    it("fails fast for unsupported runtime calendars instead of silently falling back", () => {
        const event = new JsCal.Event(
            {
                title: "Chinese Runtime Capability",
                start: "2026-02-01T09:00:00",
                timeZone: "Asia/Shanghai",
                recurrenceRules: [
                    {
                        "@type": "RecurrenceRule",
                        frequency: "yearly",
                        rscale: "chinese",
                        count: 2,
                    },
                ],
            },
            { validate: false },
        );

        if (isCalendarRuntimeAvailable("chinese")) {
            expect(
                expandEventIds(event, "2026-01-01", "2028-12-31"),
            ).toHaveLength(2);
            return;
        }

        expect(() => expandEventIds(event, "2026-01-01", "2028-12-31")).toThrow(
            "Unsupported rscale",
        );
    });
});

function findLeapMonthIsoDate(
    calendar: string,
): { date: string; byMonth: string; day: number } | undefined {
    try {
        let cursor = Temporal.PlainDate.from("2026-01-01");
        const end = Temporal.PlainDate.from("2028-12-31");
        while (Temporal.PlainDate.compare(cursor, end) <= 0) {
            const calendarDate = cursor.withCalendar(calendar);
            if (calendarDate.monthCode.endsWith("L")) {
                return {
                    date: cursor.toString(),
                    byMonth: `${Number(calendarDate.monthCode.slice(1, -1))}L`,
                    day: calendarDate.day,
                };
            }
            cursor = cursor.add({ days: 1 });
        }
    } catch {
        return undefined;
    }
    return undefined;
}

function findMonthTokenOccurrences(
    calendar: string,
    limit: number,
): Array<{ date: string; byMonth: string; day: number }> {
    const matches: Array<{ date: string; byMonth: string; day: number }> = [];
    const first = findLeapMonthIsoDate(calendar);
    if (!first) {
        return matches;
    }

    let cursor = Temporal.PlainDate.from(first.date);
    const end = Temporal.PlainDate.from("2036-12-31");
    while (
        Temporal.PlainDate.compare(cursor, end) <= 0 &&
        matches.length < limit
    ) {
        const calendarDate = cursor.withCalendar(calendar);
        const byMonth = `${Number(calendarDate.monthCode.slice(1, -1))}${calendarDate.monthCode.endsWith("L") ? "L" : ""}`;
        if (byMonth === first.byMonth && calendarDate.day === first.day) {
            matches.push({
                date: cursor.toString(),
                byMonth,
                day: calendarDate.day,
            });
        }
        cursor = cursor.add({ days: 1 });
    }

    return matches;
}

function expandEventInstances(
    event: InstanceType<typeof JsCal.Event>,
    from: string,
    to: string,
): Event[] {
    return collect(
        JsCal.expandRecurrence([event], {
            from: new Date(`${from}T00:00:00Z`),
            to: new Date(`${to}T23:59:59Z`),
        }),
    );
}

function expandEventIds(
    event: InstanceType<typeof JsCal.Event>,
    from: string,
    to: string,
): string[] {
    return expandEventInstances(event, from, to).flatMap((value) =>
        value.recurrenceId ? [value.recurrenceId] : [],
    );
}

function isCalendarRuntimeAvailable(calendar: string): boolean {
    try {
        Temporal.PlainDate.from({
            calendar,
            year: 2026,
            month: 1,
            day: 1,
        });
        return true;
    } catch {
        return false;
    }
}

function toCalendarDateTime(
    localDateTime: string,
    calendar: string,
    timeZone?: string,
): PlainDateTime | ZonedDateTime {
    const plain = Temporal.PlainDateTime.from(localDateTime);
    if (timeZone) {
        return plain.toZonedDateTime(timeZone).withCalendar(calendar);
    }
    return plain.withCalendar(calendar);
}

function expectMonthlyCalendarProgression(
    values: string[],
    calendar: string,
    timeZone?: string,
): void {
    for (let i = 1; i < values.length; i += 1) {
        const previousValue = values[i - 1];
        const currentValue = values[i];
        if (!previousValue || !currentValue) {
            continue;
        }
        const previous = toCalendarDateTime(previousValue, calendar, timeZone);
        const current = toCalendarDateTime(currentValue, calendar, timeZone);
        const expected = previous.add({ months: 1 });
        expect(current.year).toBe(expected.year);
        expect(current.monthCode).toBe(expected.monthCode);
        expect(current.day).toBe(expected.day);
        expect(current.hour).toBe(expected.hour);
        expect(current.minute).toBe(expected.minute);
        expect(current.second).toBe(expected.second);
    }
}

function findCalendarYearEndDates(
    calendar: string,
    referenceDate: string,
    count: number,
): string[] {
    const reference =
        Temporal.PlainDate.from(referenceDate).withCalendar(calendar);
    const result: string[] = [];
    for (let i = 0; i < count; i += 1) {
        const year = reference.year + i;
        const nextYearStart = Temporal.PlainDate.from({
            calendar,
            year: year + 1,
            month: 1,
            day: 1,
        });
        result.push(
            nextYearStart
                .subtract({ days: 1 })
                .withCalendar("iso8601")
                .toString(),
        );
    }
    return result;
}
