import { describe, expect, it } from "vitest";
import { JsCal } from "../jscal.js";
import type { Event, Group, Task } from "../types.js";

const task: Task = {
    "@type": "Task",
    uid: "t1",
    updated: "2026-02-01T00:00:00Z",
    title: "Write notes",
    description: "Prepare summary",
    sequence: 1,
    start: "2026-02-02T09:00:00",
    due: "2026-02-02T17:00:00",
    timeZone: "America/Los_Angeles",
    percentComplete: 50,
    progress: "in-process",
};

const group: Group = {
    "@type": "Group",
    uid: "g1",
    updated: "2026-02-01T00:00:00Z",
    title: "Group",
    entries: [task],
};

const event: Event = {
    "@type": "Event",
    uid: "e2",
    updated: "2026-02-01T00:00:00Z",
    title: "Planning",
    start: "2026-02-03T09:00:00",
};

const taskWithMethod: Task = {
    "@type": "Task",
    uid: "t2",
    updated: "2026-02-01T00:00:00Z",
    title: "Method test",
    method: "request",
};

const taskWithoutTimeZone: Task = {
    "@type": "Task",
    uid: "t3",
    updated: "2026-02-01T00:00:00Z",
    title: "No TZ",
    start: "2026-02-05T09:00:00",
    due: "2026-02-05T17:00:00",
};

describe("toICal extras", () => {
    it("exports VTODO with key fields", () => {
        const ical = JsCal.toICal([task], { includeXJSCalendar: false });
        expect(ical).toContain("BEGIN:VTODO");
        expect(ical).toContain("UID:t1");
        expect(ical).toContain(
            "DTSTART;TZID=America/Los_Angeles:20260202T090000",
        );
        expect(ical).toContain("DUE;TZID=America/Los_Angeles:20260202T170000");
        expect(ical).toContain("PERCENT-COMPLETE:50");
        expect(ical).toContain("STATUS:IN-PROCESS");
    });

    it("exports group as VCALENDAR with entries", () => {
        const ical = JsCal.toICal([group], { includeXJSCalendar: true });
        expect(ical).toContain("BEGIN:VCALENDAR");
        expect(ical).toContain("X-JSCALENDAR-GROUP:");
        expect(ical).toContain("BEGIN:VTODO");
    });

    it("exports mixed arrays (group + event + task)", () => {
        const ical = JsCal.toICal([group, event, task]);
        expect(ical).toContain("BEGIN:VEVENT");
        expect(ical).toContain("BEGIN:VTODO");
    });

    it("uses method from first object that defines it", () => {
        const ical = JsCal.toICal([event, taskWithMethod]);
        expect(ical).toContain("METHOD:REQUEST");
    });

    it("exports VTODO without time zone parameters", () => {
        const ical = JsCal.toICal([taskWithoutTimeZone], {
            includeXJSCalendar: false,
        });
        expect(ical).toContain("DTSTART:20260205T090000");
        expect(ical).toContain("DUE:20260205T170000");
    });

    it("ignores unknown object types", () => {
        const unknownObject = {
            "@type": "Unknown",
            uid: "x1",
            updated: "2026-02-01T00:00:00Z",
        };
        // @ts-expect-error unknown object type
        const ical = JsCal.toICal([unknownObject], {
            includeXJSCalendar: false,
        });
        expect(ical).toContain("BEGIN:VCALENDAR");
        expect(ical).not.toContain("BEGIN:VEVENT");
        expect(ical).not.toContain("BEGIN:VTODO");
    });
});
