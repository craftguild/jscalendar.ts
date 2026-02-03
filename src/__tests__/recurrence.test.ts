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

    const occ = collect(JsCal.expandRecurrence([second, first], {
      from: new Date("2026-02-01"),
      to: new Date("2026-02-10"),
    }));

    const starts = occ.map((o) => o.recurrenceId ?? ("start" in o ? o.start : undefined));
    expect(starts).toEqual([
      "2026-02-01T09:00:00",
      "2026-02-03T09:00:00",
    ]);
  });

  it("expands weekly byDay", () => {
    const event = new JsCal.Event({
      title: "Weekly",
      start: "2026-02-04T10:30:00",
      recurrenceRules: [
        { "@type": "RecurrenceRule", frequency: "weekly", byDay: [{ "@type": "NDay", day: "we" }] },
      ],
    });

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-02-01"),
      to: new Date("2026-02-28"),
    }));

    const starts = occ.map((o) => o.recurrenceId);
    expect(starts).toEqual([
      "2026-02-04T10:30:00",
      "2026-02-11T10:30:00",
      "2026-02-18T10:30:00",
      "2026-02-25T10:30:00",
    ]);
  });

  it("adds implicit byDay for weekly rules", () => {
    const event = new JsCal.Event({
      title: "Weekly",
      start: "2026-02-02T09:00:00",
      recurrenceRules: [
        { "@type": "RecurrenceRule", frequency: "weekly" },
      ],
    });

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-02-01"),
      to: new Date("2026-02-20"),
    }));

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

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-02-01"),
      to: new Date("2026-03-01"),
    }));

    const starts = occ.map((o) => o.recurrenceId);
    expect(starts).toEqual([
      "2026-02-02T09:00:00",
      "2026-02-09T09:00:00",
    ]);
  });

  it("applies overrides and exclusions", () => {
    const event = new JsCal.Event({
      title: "Weekly",
      start: "2026-02-04T10:30:00",
      recurrenceRules: [
        { "@type": "RecurrenceRule", frequency: "weekly", byDay: [{ "@type": "NDay", day: "we" }] },
      ],
      recurrenceOverrides: {
        "2026-02-11T10:30:00": { title: "Override" },
        "2026-02-18T10:30:00": { excluded: true },
      },
    });

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-02-01"),
      to: new Date("2026-02-28"),
    }));

    const titles = occ.map((o) => o.title);
    expect(titles).toEqual(["Weekly", "Override", "Weekly"]);
  });

  it("adds overrides outside the rule set as extra occurrences", () => {
    const event = new JsCal.Event({
      title: "Weekly",
      start: "2026-02-04T10:30:00",
      recurrenceRules: [
        { "@type": "RecurrenceRule", frequency: "weekly", byDay: [{ "@type": "NDay", day: "we" }] },
      ],
      recurrenceOverrides: {
        "2026-02-03T10:30:00": { title: "Extra" },
      },
    });

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-02-01"),
      to: new Date("2026-02-10"),
    }));

    const starts = occ.map((o) => o.recurrenceId);
    expect(starts).toEqual([
      "2026-02-03T10:30:00",
      "2026-02-04T10:30:00",
    ]);
  });

  it("removes anchor when excluded rule matches it", () => {
    const event = new JsCal.Event({
      title: "Weekly",
      start: "2026-02-04T10:30:00",
      recurrenceRules: [
        { "@type": "RecurrenceRule", frequency: "weekly", byDay: [{ "@type": "NDay", day: "we" }] },
      ],
      excludedRecurrenceRules: [
        { "@type": "RecurrenceRule", frequency: "weekly", byDay: [{ "@type": "NDay", day: "we" }] },
      ],
    });

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-02-01"),
      to: new Date("2026-02-10"),
    }));

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

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-01-01"),
      to: new Date("2026-03-31"),
    }));

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
        { "@type": "RecurrenceRule", frequency: "monthly", byMonthDay: [-1] },
      ],
    });

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-01-01"),
      to: new Date("2026-03-31"),
    }));

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
        { "@type": "RecurrenceRule", frequency: "monthly", byMonthDay: [31], skip: "forward" },
      ],
    });

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-02-01"),
      to: new Date("2026-03-31"),
    }));

    const starts = occ.map((o) => o.recurrenceId);
    expect(starts).toEqual([
      "2026-03-01T09:00:00",
      "2026-03-31T09:00:00",
    ]);
  });

  it("applies skip=backward for invalid month days", () => {
    const event = new JsCal.Event({
      title: "Day 31",
      start: "2026-01-31T09:00:00",
      recurrenceRules: [
        { "@type": "RecurrenceRule", frequency: "monthly", byMonthDay: [31], skip: "backward" },
      ],
    });

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-02-01"),
      to: new Date("2026-03-31"),
    }));

    const starts = occ.map((o) => o.recurrenceId);
    expect(starts).toEqual([
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

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-02-01"),
      to: new Date("2026-02-10"),
    }));

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

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-02-01T10:00:00"),
      to: new Date("2026-02-01T12:30:00"),
    }));

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

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-02-01T10:15:00"),
      to: new Date("2026-02-01T10:17:00"),
    }));

    const starts = occ.map((o) => o.recurrenceId);
    expect(starts).toEqual([
      "2026-02-01T10:15:45",
      "2026-02-01T10:16:45",
    ]);
  });

  it("supports yearly byYearDay rules", () => {
    const event = new JsCal.Event({
      title: "Day 32",
      start: "2026-01-01T09:00:00",
      recurrenceRules: [
        { "@type": "RecurrenceRule", frequency: "yearly", byYearDay: [32] },
      ],
    });

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-01-01"),
      to: new Date("2026-02-10"),
    }));

    const starts = occ.map((o) => o.recurrenceId);
    expect(starts).toEqual([
      "2026-01-01T09:00:00",
      "2026-02-01T09:00:00",
    ]);
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

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-01-01"),
      to: new Date("2026-01-10"),
    }));

    const starts = occ.map((o) => o.recurrenceId);
    expect(starts).toEqual([
      "2026-01-01T09:00:00",
    ]);
  });

  it("supports secondly frequency", () => {
    const event = new JsCal.Event({
      title: "Secondly",
      start: "2026-02-01T10:15:30",
      recurrenceRules: [
        { "@type": "RecurrenceRule", frequency: "secondly", count: 2 },
      ],
    });

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-02-01T10:15:29"),
      to: new Date("2026-02-01T10:15:31"),
    }));

    const starts = occ.map((o) => o.recurrenceId);
    expect(starts).toEqual([
      "2026-02-01T10:15:30",
      "2026-02-01T10:15:31",
    ]);
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
      for (const _ of JsCal.expandRecurrence([bad], { from: new Date("2026-02-01"), to: new Date("2026-02-02") })) {
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

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-02-01"),
      to: new Date("2026-03-31"),
    }));

    const starts = occ.map((o) => o.recurrenceId);
    expect(starts).toEqual([
      "2026-02-09T09:00:00",
      "2026-03-09T09:00:00",
    ]);
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

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-12-01"),
      to: new Date("2026-12-31"),
    }));

    const starts = occ.map((o) => o.recurrenceId);
    expect(starts).toEqual([
      "2026-12-27T09:00:00",
    ]);
  });

  it("supports byMonth filters", () => {
    const event = new JsCal.Event({
      title: "ByMonth",
      start: "2026-03-01T09:00:00",
      recurrenceRules: [
        { "@type": "RecurrenceRule", frequency: "yearly", byMonth: ["3"], count: 2 },
      ],
    });

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-03-01"),
      to: new Date("2027-03-02"),
    }));

    const starts = occ.map((o) => o.recurrenceId);
    expect(starts).toEqual([
      "2026-03-01T09:00:00",
      "2027-03-01T09:00:00",
    ]);
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

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-02-01T01:00:00Z"),
      to: new Date("2026-02-01T01:00:00Z"),
    }));

    const starts = occ.map((o) => o.recurrenceId);
    expect(starts).toEqual([
      "2026-02-01T10:00:00",
    ]);
  });

  it("supports daily frequency", () => {
    const event = new JsCal.Event({
      title: "Daily",
      start: "2026-02-01T09:00:00",
      recurrenceRules: [
        { "@type": "RecurrenceRule", frequency: "daily", count: 3 },
      ],
    });

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-02-01"),
      to: new Date("2026-02-04"),
    }));

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

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-02-01"),
      to: new Date("2026-02-10"),
    }));

    const starts = occ.map((o) => o.recurrenceId);
    expect(starts).toEqual([
      "2026-02-02T09:00:00",
    ]);
  });

  it("uses implicit byMonthDay for monthly rules", () => {
    const event = new JsCal.Event({
      title: "Monthly Default",
      start: "2026-02-10T09:00:00",
      recurrenceRules: [
        { "@type": "RecurrenceRule", frequency: "monthly", count: 2 },
      ],
    });

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-02-01"),
      to: new Date("2026-03-31"),
    }));

    const starts = occ.map((o) => o.recurrenceId);
    expect(starts).toEqual([
      "2026-02-10T09:00:00",
      "2026-03-10T09:00:00",
    ]);
  });

  it("adds byMonth defaults for yearly rules with byMonthDay", () => {
    const event = new JsCal.Event({
      title: "Yearly ByMonthDay",
      start: "2026-02-01T09:00:00",
      recurrenceRules: [
        { "@type": "RecurrenceRule", frequency: "yearly", byMonthDay: [1], count: 2 },
      ],
    });

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-02-01"),
      to: new Date("2027-02-02"),
    }));

    const starts = occ.map((o) => o.recurrenceId);
    expect(starts).toEqual([
      "2026-02-01T09:00:00",
      "2027-02-01T09:00:00",
    ]);
  });

  it("adds byDay defaults for yearly byWeekNo rules", () => {
    const event = new JsCal.Event({
      title: "Week 1 Default Day",
      start: "2026-01-01T09:00:00",
      recurrenceRules: [
        { "@type": "RecurrenceRule", frequency: "yearly", byWeekNo: [1], count: 1 },
      ],
    });

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-01-01"),
      to: new Date("2026-01-10"),
    }));

    const starts = occ.map((o) => o.recurrenceId);
    expect(starts).toEqual([
      "2026-01-01T09:00:00",
    ]);
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

    const occ = collect(JsCal.expandRecurrence([event], {
      from: new Date("2026-01-01"),
      to: new Date("2026-03-31"),
    }));

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

    const occ = Array.from(JsCal.expandRecurrence([task], {
      from: new Date("2026-02-01"),
      to: new Date("2026-02-03"),
    }));

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
    const occ = Array.from(JsCal.expandRecurrence([task], {
      from: new Date("2026-02-01"),
      to: new Date("2026-02-02"),
    }));
    expect(occ.length).toBe(0);
  });

  it("throws on unsupported rscale during expansion", () => {
    const event = new JsCal.Event({
      title: "Bad Rscale",
      start: "2026-02-01T10:00:00",
      recurrenceRules: [
        { "@type": "RecurrenceRule", frequency: "daily", rscale: "hebrew" },
      ],
    }, { validate: false });

    expect(() => {
      for (const _ of JsCal.expandRecurrence([event], { from: new Date("2026-02-01"), to: new Date("2026-02-02") })) {
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

    const page2 = JsCal.expandRecurrencePaged([event], range, { limit: 2, cursor: page1.nextCursor });
    const page2Starts = page2.items.map((o) => o.recurrenceId);
    expect(page2Starts).toEqual([
      "2026-02-16T09:00:00",
      "2026-02-23T09:00:00",
    ]);
    expect(page2.nextCursor).toBe("2026-02-23T09:00:00");
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
