import { describe, expect, it } from "vitest";
import { JsCal } from "../jscal.js";
import type { JSCalendarObject } from "../types.js";

function collect(gen: Generator<JSCalendarObject>): JSCalendarObject[] {
    const result: JSCalendarObject[] = [];
    for (const item of gen) {
        if (item["@type"] === "Event") result.push(item);
    }
    return result;
}

type IncludeAnchorCase = {
    name: string;
    event: InstanceType<typeof JsCal.Event>;
    range: {
        from: Date;
        to: Date;
    };
    expected: string[];
};

describe("recurrence expansion", () => {
    it("sorts occurrences by recurrenceId across items", () => {
        const first = new JsCal.Event({
            title: "First",
            start: "2026-02-01T09:00:00",
        });
        const second = new JsCal.Event({
            title: "Second",
            start: "2026-02-03T09:00:00",
        });

        const occ = collect(
            JsCal.expandRecurrence([second, first], {
                from: new Date("2026-02-01"),
                to: new Date("2026-02-10"),
            }),
        );

        const starts = occ.map(
            (o) => o.recurrenceId ?? ("start" in o ? o.start : undefined),
        );
        expect(starts).toEqual(["2026-02-01T09:00:00", "2026-02-03T09:00:00"]);
    });

    it("expands weekly byDay", () => {
        const event = new JsCal.Event({
            title: "Weekly",
            start: "2026-02-04T10:30:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "weekly",
                    byDay: [{ "@type": "NDay", day: "we" }],
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-02-01"),
                to: new Date("2026-02-28"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual([
            "2026-02-04T10:30:00",
            "2026-02-11T10:30:00",
            "2026-02-18T10:30:00",
            "2026-02-25T10:30:00",
        ]);
    });

    it("uses week boundaries for weekly byDay with large intervals", () => {
        const event = new JsCal.Event({
            title: "Biweekly-ish",
            start: "2026-03-27T09:00:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "weekly",
                    interval: 14,
                    byDay: [{ "@type": "NDay", day: "we" }],
                    until: "2026-04-27T08:59:00",
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-03-01"),
                to: new Date("2026-04-27T08:59:00"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual(["2026-03-27T09:00:00"]);
    });

    it("omits the source occurrence when includeAnchor is false", () => {
        const event = new JsCal.Event({
            title: "Weekly",
            start: "2026-03-27T09:00:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "weekly",
                    byDay: [{ "@type": "NDay", day: "we" }],
                    count: 3,
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence(
                [event],
                {
                    from: new Date("2026-03-01"),
                    to: new Date("2026-04-30"),
                },
                { includeAnchor: false },
            ),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual([
            "2026-04-01T09:00:00",
            "2026-04-08T09:00:00",
            "2026-04-15T09:00:00",
        ]);
    });

    it("omits the source occurrence for BY* rules when includeAnchor is false", () => {
        const cases: IncludeAnchorCase[] = [
            {
                name: "weekly byDay",
                event: new JsCal.Event({
                    title: "Weekly",
                    start: "2026-03-27T09:00:00",
                    recurrenceRules: [
                        {
                            "@type": "RecurrenceRule",
                            frequency: "weekly",
                            byDay: [{ "@type": "NDay", day: "we" }],
                            count: 3,
                        },
                    ],
                }),
                range: {
                    from: new Date("2026-03-01"),
                    to: new Date("2026-04-30"),
                },
                expected: [
                    "2026-04-01T09:00:00",
                    "2026-04-08T09:00:00",
                    "2026-04-15T09:00:00",
                ],
            },
            {
                name: "monthly byDay nthOfPeriod",
                event: new JsCal.Event({
                    title: "Second Monday",
                    start: "2026-02-09T09:00:00",
                    recurrenceRules: [
                        {
                            "@type": "RecurrenceRule",
                            frequency: "monthly",
                            byDay: [
                                { "@type": "NDay", day: "mo", nthOfPeriod: 2 },
                            ],
                            count: 3,
                        },
                    ],
                }),
                range: {
                    from: new Date("2026-02-01"),
                    to: new Date("2026-04-30"),
                },
                expected: ["2026-03-09T09:00:00", "2026-04-13T09:00:00"],
            },
            {
                name: "yearly byDay nthOfPeriod",
                event: new JsCal.Event({
                    title: "Last Sunday of year",
                    start: "2026-12-27T09:00:00",
                    recurrenceRules: [
                        {
                            "@type": "RecurrenceRule",
                            frequency: "yearly",
                            byDay: [
                                { "@type": "NDay", day: "su", nthOfPeriod: -1 },
                            ],
                            count: 2,
                        },
                    ],
                }),
                range: {
                    from: new Date("2026-12-01"),
                    to: new Date("2027-12-31"),
                },
                expected: ["2027-12-26T09:00:00"],
            },
            {
                name: "monthly byMonthDay",
                event: new JsCal.Event({
                    title: "Last Day",
                    start: "2026-01-31T09:00:00",
                    recurrenceRules: [
                        {
                            "@type": "RecurrenceRule",
                            frequency: "monthly",
                            byMonthDay: [-1],
                            count: 3,
                        },
                    ],
                }),
                range: {
                    from: new Date("2026-01-01"),
                    to: new Date("2026-03-31"),
                },
                expected: ["2026-02-28T09:00:00", "2026-03-31T09:00:00"],
            },
            {
                name: "yearly byYearDay",
                event: new JsCal.Event({
                    title: "Day 32",
                    start: "2026-01-01T09:00:00",
                    recurrenceRules: [
                        {
                            "@type": "RecurrenceRule",
                            frequency: "yearly",
                            byYearDay: [32],
                            count: 2,
                        },
                    ],
                }),
                range: {
                    from: new Date("2026-01-01"),
                    to: new Date("2027-02-10"),
                },
                expected: ["2026-02-01T09:00:00", "2027-02-01T09:00:00"],
            },
            {
                name: "yearly byWeekNo",
                event: new JsCal.Event({
                    title: "Week 1 Thursday",
                    start: "2026-01-01T09:00:00",
                    recurrenceRules: [
                        {
                            "@type": "RecurrenceRule",
                            frequency: "yearly",
                            byWeekNo: [1],
                            byDay: [{ "@type": "NDay", day: "th" }],
                            count: 2,
                        },
                    ],
                }),
                range: {
                    from: new Date("2026-01-01"),
                    to: new Date("2027-01-10"),
                },
                expected: ["2027-01-07T09:00:00"],
            },
            {
                name: "yearly byMonth",
                event: new JsCal.Event({
                    title: "ByMonth",
                    start: "2026-03-01T09:00:00",
                    recurrenceRules: [
                        {
                            "@type": "RecurrenceRule",
                            frequency: "yearly",
                            byMonth: ["3"],
                            count: 2,
                        },
                    ],
                }),
                range: {
                    from: new Date("2026-03-01"),
                    to: new Date("2027-03-02"),
                },
                expected: ["2027-03-01T09:00:00"],
            },
            {
                name: "monthly bySetPosition",
                event: new JsCal.Event({
                    title: "Last Wednesday",
                    start: "2026-01-07T10:00:00",
                    recurrenceRules: [
                        {
                            "@type": "RecurrenceRule",
                            frequency: "monthly",
                            byDay: [{ "@type": "NDay", day: "we" }],
                            bySetPosition: [-1],
                            count: 4,
                        },
                    ],
                }),
                range: {
                    from: new Date("2026-01-01"),
                    to: new Date("2026-03-31"),
                },
                expected: [
                    "2026-01-28T10:00:00",
                    "2026-02-25T10:00:00",
                    "2026-03-25T10:00:00",
                ],
            },
        ];

        for (const testCase of cases) {
            const occ = collect(
                JsCal.expandRecurrence([testCase.event], testCase.range, {
                    includeAnchor: false,
                }),
            );

            const starts = occ.map((o) => o.recurrenceId);
            expect(starts, testCase.name).toEqual(testCase.expected);
        }
    });

    it("adds implicit byDay for weekly rules", () => {
        const event = new JsCal.Event({
            title: "Weekly",
            start: "2026-02-02T09:00:00",
            recurrenceRules: [
                { "@type": "RecurrenceRule", frequency: "weekly" },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-02-01"),
                to: new Date("2026-02-20"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual([
            "2026-02-02T09:00:00",
            "2026-02-09T09:00:00",
            "2026-02-16T09:00:00",
        ]);
    });

    it("respects count including the anchor", () => {
        const event = new JsCal.Event({
            title: "Weekly",
            start: "2026-02-02T09:00:00",
            recurrenceRules: [
                { "@type": "RecurrenceRule", frequency: "weekly", count: 2 },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-02-01"),
                to: new Date("2026-03-01"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual(["2026-02-02T09:00:00", "2026-02-09T09:00:00"]);
    });

    it("applies overrides and exclusions", () => {
        const event = new JsCal.Event({
            title: "Weekly",
            start: "2026-02-04T10:30:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "weekly",
                    byDay: [{ "@type": "NDay", day: "we" }],
                },
            ],
            recurrenceOverrides: {
                "2026-02-11T10:30:00": { title: "Override" },
                "2026-02-18T10:30:00": { excluded: true },
            },
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-02-01"),
                to: new Date("2026-02-28"),
            }),
        );

        const titles = occ.map((o) => o.title);
        expect(titles).toEqual(["Weekly", "Override", "Weekly"]);
    });

    it("adds overrides outside the rule set as extra occurrences", () => {
        const event = new JsCal.Event({
            title: "Weekly",
            start: "2026-02-04T10:30:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "weekly",
                    byDay: [{ "@type": "NDay", day: "we" }],
                },
            ],
            recurrenceOverrides: {
                "2026-02-03T10:30:00": { title: "Extra" },
            },
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-02-01"),
                to: new Date("2026-02-10"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual(["2026-02-03T10:30:00", "2026-02-04T10:30:00"]);
    });

    it("removes anchor when excluded rule matches it", () => {
        const event = new JsCal.Event({
            title: "Weekly",
            start: "2026-02-04T10:30:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "weekly",
                    byDay: [{ "@type": "NDay", day: "we" }],
                },
            ],
            excludedRecurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "weekly",
                    byDay: [{ "@type": "NDay", day: "we" }],
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-02-01"),
                to: new Date("2026-02-10"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual([]);
    });

    it("supports bySetPosition on monthly rules", () => {
        const event = new JsCal.Event({
            title: "First Wednesday",
            start: "2026-01-07T10:00:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "monthly",
                    byDay: [{ "@type": "NDay", day: "we" }],
                    bySetPosition: [1],
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-01-01"),
                to: new Date("2026-03-31"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual([
            "2026-01-07T10:00:00",
            "2026-02-04T10:00:00",
            "2026-03-04T10:00:00",
        ]);
    });

    it("supports negative byMonthDay values", () => {
        const event = new JsCal.Event({
            title: "Last Day",
            start: "2026-01-31T09:00:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "monthly",
                    byMonthDay: [-1],
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-01-01"),
                to: new Date("2026-03-31"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual([
            "2026-01-31T09:00:00",
            "2026-02-28T09:00:00",
            "2026-03-31T09:00:00",
        ]);
    });

    it("applies skip=forward for invalid month days", () => {
        const event = new JsCal.Event({
            title: "Day 31",
            start: "2026-01-31T09:00:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "monthly",
                    byMonthDay: [31],
                    skip: "forward",
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-02-01"),
                to: new Date("2026-03-31"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual(["2026-03-01T09:00:00", "2026-03-31T09:00:00"]);
    });

    it("applies skip=backward for invalid month days", () => {
        const event = new JsCal.Event({
            title: "Day 31",
            start: "2026-01-31T09:00:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "monthly",
                    byMonthDay: [31],
                    skip: "backward",
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-02-01"),
                to: new Date("2026-03-31"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual(["2026-02-28T09:00:00", "2026-03-31T09:00:00"]);
    });

    it("clamps large byMonthDay values to the month end with skip=backward", () => {
        const event = new JsCal.Event({
            title: "Day 99",
            start: "2026-01-31T09:00:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "monthly",
                    byMonthDay: [99],
                    skip: "backward",
                    count: 3,
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-01-01"),
                to: new Date("2026-03-31"),
            }),
        );

        expect(occ.map((o) => o.recurrenceId)).toEqual([
            "2026-01-31T09:00:00",
            "2026-02-28T09:00:00",
            "2026-03-31T09:00:00",
        ]);
    });

    it("sets recurrenceIdTimeZone on instances", () => {
        const event = new JsCal.Event({
            title: "Weekly",
            start: "2026-02-02T09:00:00",
            timeZone: "Asia/Tokyo",
            recurrenceRules: [
                { "@type": "RecurrenceRule", frequency: "weekly" },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-02-01"),
                to: new Date("2026-02-10"),
            }),
        );

        const zones = occ.map((o) => o.recurrenceIdTimeZone);
        expect(zones).toEqual(["Asia/Tokyo", "Asia/Tokyo"]);
    });

    it("supports hourly frequency with implicit minutes and seconds", () => {
        const event = new JsCal.Event({
            title: "Hourly",
            start: "2026-02-01T10:15:30",
            recurrenceRules: [
                { "@type": "RecurrenceRule", frequency: "hourly", count: 3 },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-02-01T10:00:00"),
                to: new Date("2026-02-01T12:30:00"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual([
            "2026-02-01T10:15:30",
            "2026-02-01T11:15:30",
            "2026-02-01T12:15:30",
        ]);
    });

    it("supports minutely frequency with implicit seconds", () => {
        const event = new JsCal.Event({
            title: "Minutely",
            start: "2026-02-01T10:15:45",
            recurrenceRules: [
                { "@type": "RecurrenceRule", frequency: "minutely", count: 2 },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-02-01T10:15:00"),
                to: new Date("2026-02-01T10:17:00"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual(["2026-02-01T10:15:45", "2026-02-01T10:16:45"]);
    });

    it("supports yearly byYearDay rules", () => {
        const event = new JsCal.Event({
            title: "Day 32",
            start: "2026-01-01T09:00:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    byYearDay: [32],
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-01-01"),
                to: new Date("2026-02-10"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual(["2026-01-01T09:00:00", "2026-02-01T09:00:00"]);
    });

    it("supports yearly byWeekNo rules", () => {
        const event = new JsCal.Event({
            title: "Week 1 Thursday",
            start: "2026-01-01T09:00:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    byWeekNo: [1],
                    byDay: [{ "@type": "NDay", day: "th" }],
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-01-01"),
                to: new Date("2026-01-10"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual(["2026-01-01T09:00:00"]);
    });

    it("handles negative byWeekNo at year end without spilling into next week-year", () => {
        const event = new JsCal.Event({
            title: "Last Week Monday",
            start: "2018-12-24T09:00:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    byWeekNo: [-1],
                    byDay: [{ "@type": "NDay", day: "mo" }],
                    count: 2,
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2018-01-01"),
                to: new Date("2019-12-31"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual(["2018-12-24T09:00:00", "2019-12-23T09:00:00"]);
    });

    it("supports secondly frequency", () => {
        const event = new JsCal.Event({
            title: "Secondly",
            start: "2026-02-01T10:15:30",
            recurrenceRules: [
                { "@type": "RecurrenceRule", frequency: "secondly", count: 2 },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-02-01T10:15:29"),
                to: new Date("2026-02-01T10:15:31"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual(["2026-02-01T10:15:30", "2026-02-01T10:15:31"]);
    });

    it("throws on invalid LocalDateTime", () => {
        const event = new JsCal.Event({
            title: "Invalid",
            start: "2026-02-01T10:15:30",
            recurrenceRules: [
                { "@type": "RecurrenceRule", frequency: "daily" },
            ],
        });
        const bad = { ...event.eject(), start: "invalid" };
        expect(() => {
            for (const _ of JsCal.expandRecurrence([bad], {
                from: new Date("2026-02-01"),
                to: new Date("2026-02-02"),
            })) {
                void 0;
            }
        }).toThrow();
    });

    it("supports byDay with nthOfPeriod (monthly)", () => {
        const event = new JsCal.Event({
            title: "Second Monday",
            start: "2026-02-09T09:00:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "monthly",
                    byDay: [{ "@type": "NDay", day: "mo", nthOfPeriod: 2 }],
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-02-01"),
                to: new Date("2026-03-31"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual(["2026-02-09T09:00:00", "2026-03-09T09:00:00"]);
    });

    it("supports byDay with nthOfPeriod (yearly)", () => {
        const event = new JsCal.Event({
            title: "Last Sunday of year",
            start: "2026-12-27T09:00:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    byDay: [{ "@type": "NDay", day: "su", nthOfPeriod: -1 }],
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-12-01"),
                to: new Date("2026-12-31"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual(["2026-12-27T09:00:00"]);
    });

    it("supports byMonth filters", () => {
        const event = new JsCal.Event({
            title: "ByMonth",
            start: "2026-03-01T09:00:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    byMonth: ["3"],
                    count: 2,
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-03-01"),
                to: new Date("2027-03-02"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual(["2026-03-01T09:00:00", "2027-03-01T09:00:00"]);
    });

    it("converts range dates into event time zone", () => {
        const event = new JsCal.Event({
            title: "TZ Range",
            start: "2026-02-01T10:00:00",
            timeZone: "Asia/Tokyo",
            recurrenceRules: [
                { "@type": "RecurrenceRule", frequency: "daily", count: 1 },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-02-01T01:00:00Z"),
                to: new Date("2026-02-01T01:00:00Z"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual(["2026-02-01T10:00:00"]);
    });

    it("supports daily frequency", () => {
        const event = new JsCal.Event({
            title: "Daily",
            start: "2026-02-01T09:00:00",
            recurrenceRules: [
                { "@type": "RecurrenceRule", frequency: "daily", count: 3 },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-02-01"),
                to: new Date("2026-02-04"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual([
            "2026-02-01T09:00:00",
            "2026-02-02T09:00:00",
            "2026-02-03T09:00:00",
        ]);
    });

    it("ignores nthOfPeriod for weekly rules", () => {
        const event = new JsCal.Event({
            title: "Weekly Nth",
            start: "2026-02-02T09:00:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "weekly",
                    byDay: [{ "@type": "NDay", day: "mo", nthOfPeriod: 1 }],
                    count: 2,
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-02-01"),
                to: new Date("2026-02-10"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual(["2026-02-02T09:00:00"]);
    });

    it("uses implicit byMonthDay for monthly rules", () => {
        const event = new JsCal.Event({
            title: "Monthly Default",
            start: "2026-02-10T09:00:00",
            recurrenceRules: [
                { "@type": "RecurrenceRule", frequency: "monthly", count: 2 },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-02-01"),
                to: new Date("2026-03-31"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual(["2026-02-10T09:00:00", "2026-03-10T09:00:00"]);
    });

    it("adds byMonth defaults for yearly rules with byMonthDay", () => {
        const event = new JsCal.Event({
            title: "Yearly ByMonthDay",
            start: "2026-02-01T09:00:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    byMonthDay: [1],
                    count: 2,
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-02-01"),
                to: new Date("2027-02-02"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual(["2026-02-01T09:00:00", "2027-02-01T09:00:00"]);
    });

    it("adds byDay defaults for yearly byWeekNo rules", () => {
        const event = new JsCal.Event({
            title: "Week 1 Default Day",
            start: "2026-01-01T09:00:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    byWeekNo: [1],
                    count: 1,
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-01-01"),
                to: new Date("2026-01-10"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual(["2026-01-01T09:00:00"]);
    });

    it("supports negative bySetPosition values", () => {
        const event = new JsCal.Event({
            title: "Last Wednesday",
            start: "2026-01-07T10:00:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "monthly",
                    byDay: [{ "@type": "NDay", day: "we" }],
                    bySetPosition: [-1],
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-01-01"),
                to: new Date("2026-03-31"),
            }),
        );

        const starts = occ.map((o) => o.recurrenceId);
        expect(starts).toEqual([
            "2026-01-07T10:00:00",
            "2026-01-28T10:00:00",
            "2026-02-25T10:00:00",
            "2026-03-25T10:00:00",
        ]);
    });

    it("expands tasks that only have due dates", () => {
        const task = new JsCal.Task({
            title: "Due Only",
            due: "2026-02-01T10:00:00",
            recurrenceRules: [
                { "@type": "RecurrenceRule", frequency: "daily", count: 2 },
            ],
            recurrenceOverrides: {
                "2026-02-02T10:00:00": { due: "2026-02-05T10:00:00" },
            },
        });

        const occ = Array.from(
            JsCal.expandRecurrence([task], {
                from: new Date("2026-02-01"),
                to: new Date("2026-02-03"),
            }),
        );

        expect(occ.map((o) => o.recurrenceId)).toEqual([
            "2026-02-01T10:00:00",
            "2026-02-02T10:00:00",
        ]);
        // Intentional cast to Task for test-only access to due.
        const second = occ[1] as import("../types.js").Task | undefined;
        expect(second?.due).toBe("2026-02-05T10:00:00");
    });

    it("skips tasks without start or due dates", () => {
        const task = new JsCal.Task({ title: "No Dates" });
        const occ = Array.from(
            JsCal.expandRecurrence([task], {
                from: new Date("2026-02-01"),
                to: new Date("2026-02-02"),
            }),
        );
        expect(occ.length).toBe(0);
    });

    it("throws on invalid rscale during expansion", () => {
        const event = new JsCal.Event(
            {
                title: "Bad Rscale",
                start: "2026-02-01T10:00:00",
                recurrenceRules: [
                    {
                        "@type": "RecurrenceRule",
                        frequency: "daily",
                        rscale: "not-a-calendar",
                    },
                ],
            },
            { validate: false },
        );

        expect(() => {
            for (const _ of JsCal.expandRecurrence([event], {
                from: new Date("2026-02-01"),
                to: new Date("2026-02-02"),
            })) {
                void 0;
            }
        }).toThrow("Unsupported rscale");
    });

    it("pages recurrence expansion with cursor and limit", () => {
        const event = new JsCal.Event({
            title: "Weekly",
            start: "2026-02-02T09:00:00",
            recurrenceRules: [
                { "@type": "RecurrenceRule", frequency: "weekly" },
            ],
        });

        const range = {
            from: new Date("2026-02-01"),
            to: new Date("2026-03-01"),
        };

        const page1 = JsCal.expandRecurrencePaged([event], range, { limit: 2 });
        const page1Starts = page1.items.map((o) => o.recurrenceId);
        expect(page1Starts).toEqual([
            "2026-02-02T09:00:00",
            "2026-02-09T09:00:00",
        ]);
        expect(page1.nextCursor).toBe("2026-02-09T09:00:00");

        const page2 = JsCal.expandRecurrencePaged([event], range, {
            limit: 2,
            cursor: page1.nextCursor,
        });
        const page2Starts = page2.items.map((o) => o.recurrenceId);
        expect(page2Starts).toEqual([
            "2026-02-16T09:00:00",
            "2026-02-23T09:00:00",
        ]);
        expect(page2.nextCursor).toBe("2026-02-23T09:00:00");
    });

    it("pages recurrence expansion without the source occurrence", () => {
        const event = new JsCal.Event({
            title: "Weekly",
            start: "2026-02-02T09:00:00",
            recurrenceRules: [
                { "@type": "RecurrenceRule", frequency: "weekly", count: 3 },
            ],
        });

        const range = {
            from: new Date("2026-02-01"),
            to: new Date("2026-03-01"),
        };

        const page = JsCal.expandRecurrencePaged([event], range, {
            limit: 2,
            includeAnchor: false,
        });

        const starts = page.items.map((o) => o.recurrenceId);
        expect(starts).toEqual(["2026-02-09T09:00:00", "2026-02-16T09:00:00"]);
        expect(page.nextCursor).toBe("2026-02-16T09:00:00");
    });

    it("returns empty page when cursor is beyond range", () => {
        const event = new JsCal.Event({
            title: "Weekly",
            start: "2026-02-02T09:00:00",
            recurrenceRules: [
                { "@type": "RecurrenceRule", frequency: "weekly" },
            ],
        });

        const range = {
            from: new Date("2026-02-01"),
            to: new Date("2026-02-10"),
        };

        const page = JsCal.expandRecurrencePaged([event], range, {
            limit: 2,
            cursor: "2026-02-20T09:00:00",
        });

        expect(page.items).toEqual([]);
        expect(page.nextCursor).toBeUndefined();
    });
});
