import { describe, expect, it } from "vitest";
import { JsCal } from "../jscal.js";
import type { Event } from "../types.js";

const event: Event = {
    "@type": "Event",
    uid: "e1",
    updated: "2026-02-01T00:00:00Z",
    title: "Demo",
    description: "Details",
    sequence: 2,
    start: "2026-02-01T10:00:00",
    timeZone: "America/New_York",
    duration: "PT30M",
    status: "confirmed",
    recurrenceRules: [
        {
            "@type": "RecurrenceRule",
            frequency: "weekly",
            byDay: [{ "@type": "NDay", day: "mo" }],
        },
    ],
};

describe("toICal", () => {
    it("exports minimal VEVENT with X-JSCALENDAR", () => {
        const ical = JsCal.toICal([event], { includeXJSCalendar: true });
        expect(ical).toContain("BEGIN:VCALENDAR");
        expect(ical).toContain("BEGIN:VEVENT");
        expect(ical).toContain("UID:e1");
        expect(ical).toContain("DTSTART;TZID=America/New_York:20260201T100000");
        expect(ical).toContain("DURATION:PT30M");
        expect(ical).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO");
        expect(ical).toContain("X-JSCALENDAR:");
        expect(ical).toContain("END:VEVENT");
        expect(ical).toContain("END:VCALENDAR");
    });

    it("omits X-JSCALENDAR when disabled", () => {
        const ical = JsCal.toICal([event], { includeXJSCalendar: false });
        expect(ical).not.toContain("X-JSCALENDAR:");
    });

    it("exports full recurrence rule fields", () => {
        const rich: Event = {
            "@type": "Event",
            uid: "e2",
            updated: "2026-02-01T00:00:00Z",
            title: "Rich",
            start: "2026-02-01T10:00:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "monthly",
                    interval: 2,
                    count: 5,
                    until: "2026-12-31T00:00:00",
                    byDay: [{ "@type": "NDay", day: "mo", nthOfPeriod: 1 }],
                    byMonthDay: [1, -1],
                    byMonth: ["2", "3"],
                    byYearDay: [32],
                    byWeekNo: [1],
                    byHour: [9],
                    byMinute: [30],
                    bySecond: [15],
                    bySetPosition: [1],
                    firstDayOfWeek: "mo",
                    rscale: "gregorian",
                    skip: "forward",
                },
            ],
        };

        const ical = JsCal.toICal([rich]);
        const unfolded = ical.replace(/\r\n[ \t]/g, "");
        expect(unfolded).toContain(
            "RRULE:FREQ=MONTHLY;INTERVAL=2;COUNT=5;UNTIL=20261231T000000;BYDAY=1MO;BYMONTHDAY=1,-1;BYMONTH=2,3;BYYEARDAY=32;BYWEEKNO=1;BYHOUR=9;BYMINUTE=30;BYSECOND=15;BYSETPOS=1;WKST=MO;RSCALE=GREGORIAN;SKIP=FORWARD",
        );
    });
});
