import { describe, expect, it } from "vitest";
import {
  filterByDateRange,
  filterByText,
  findByUid,
  groupByType,
} from "../search.js";
import { JsCal } from "../jscal.js";
import type { Event, Task } from "../types.js";

const event: Event = {
  "@type": "Event",
  uid: "e1",
  updated: "2026-02-01T00:00:00Z",
  title: "Sprint planning",
  description: "Discuss backlog",
  start: "2026-02-01T10:00:00",
  duration: "PT1H",
};

const task: Task = {
  "@type": "Task",
  uid: "t1",
  updated: "2026-02-01T00:00:00Z",
  title: "Write notes",
  start: "2026-02-02T09:00:00",
};

describe("search helpers", () => {
  it("finds by uid", () => {
    expect(findByUid([event, task], "t1")?.uid).toBe("t1");
  });

  it("groups by type", () => {
    const grouped = groupByType([event, task]);
    const events = grouped.Event ?? [];
    const tasks = grouped.Task ?? [];
    expect(events.length).toBe(1);
    expect(tasks.length).toBe(1);
  });

  it("filters by text", () => {
    const results = filterByText([event, task], "backlog");
    expect(results.length).toBe(1);
    const first = results[0];
    expect(first).toBeDefined();
    if (!first) throw new Error("Missing result");
    expect(first.uid).toBe("e1");
  });

  it("returns all items for empty text query", () => {
    const results = filterByText([event, task], "   ");
    expect(results.length).toBe(2);
  });

  it("indexes locations, virtual locations, and participants for text search", () => {
    const item = new JsCal.Event({
      start: "2026-02-01T10:00:00",
      title: "Meeting",
      locations: {
        l1: { "@type": "Location", name: "Room A", description: "Main room" },
      },
      virtualLocations: {
        v1: { "@type": "VirtualLocation", name: "Zoom", uri: "https://example.com" },
      },
      participants: {
        p1: { "@type": "Participant", roles: { attendee: true }, name: "Alice", email: "a@example.com" },
      },
    }).eject();

    const results = filterByText([item], "example.com");
    expect(results.length).toBe(1);
  });

  it("accepts JsCal instances via JsCal.filterByText", () => {
    const instance = new JsCal.Event({ start: "2026-02-01T10:00:00", title: "Planning" });
    const results = JsCal.filterByText([instance], "planning");
    expect(results.length).toBe(1);
    expect(results[0]?.uid).toBe(instance.data.uid);
  });

  it("uses JsCal.findByUid and JsCal.filterByType wrappers", () => {
    const items = [event, task];
    const found = JsCal.findByUid(items, "t1");
    expect(found?.uid).toBe("t1");
    const events = JsCal.filterByType(items, "Event");
    expect(events.length).toBe(1);
    expect(events[0]?.uid).toBe("e1");
  });

  it("filters by date range", () => {
    const results = filterByDateRange([event, task], {
      start: "2026-02-01T09:30:00",
      end: "2026-02-01T10:30:00",
    });
    expect(results.length).toBe(1);
    const first = results[0];
    expect(first).toBeDefined();
    if (!first) throw new Error("Missing result");
    expect(first.uid).toBe("e1");
  });

  it("uses JsCal.groupByType wrapper", () => {
    const grouped = JsCal.groupByType([event, task]);
    expect(Object.keys(grouped)).toContain("Event");
    expect(Object.keys(grouped)).toContain("Task");
  });

  it("includes incomparable when requested", () => {
    const noDateTask = new JsCal.Task({ uid: "t2", title: "No date" });
    const results = JsCal.filterByDateRange([noDateTask, event], { start: "2026-02-01T00:00:00" }, { includeIncomparable: true });
    expect(results.map((item) => item.uid).sort()).toEqual(["e1", "t2"]);
  });

  it("computes group range from entries", () => {
    const group = new JsCal.Group({
      uid: "g1",
      entries: [
        new JsCal.Event({ uid: "e2", start: "2026-02-01T10:00:00" }).eject(),
        new JsCal.Event({ uid: "e3", start: "2026-02-03T10:00:00" }).eject(),
      ],
    });

    const results = JsCal.filterByDateRange([group], { start: "2026-02-02T00:00:00" });
    expect(results.map((item) => item.uid)).toEqual(["g1"]);
  });

  it("excludes groups with no dated entries", () => {
    const group = new JsCal.Group({
      uid: "g2",
      entries: [],
    });

    const results = JsCal.filterByDateRange([group], { start: "2026-02-01T00:00:00" });
    expect(results.length).toBe(0);
  });

  it("handles duration ranges with time zones", () => {
    const tzEvent = new JsCal.Event({
      uid: "e4",
      start: "2026-02-01T10:00:00",
      timeZone: "Asia/Tokyo",
      duration: "PT1H",
    });

    const results = JsCal.filterByDateRange([tzEvent], { start: new Date("2026-02-01T01:30:00Z") });
    expect(results.map((item) => item.uid)).toEqual(["e4"]);
  });

  it("converts Date range into event time zone", () => {
    const eventWithTz = new JsCal.Event({
      uid: "e7",
      start: "2026-02-01T10:00:00",
      timeZone: "Asia/Tokyo",
    });

    const results = JsCal.filterByDateRange(
      [eventWithTz],
      { start: new Date("2026-02-01T01:00:00Z"), end: new Date("2026-02-01T01:00:00Z") },
    );
    expect(results.map((item) => item.uid)).toEqual(["e7"]);
  });

  it("excludes local floating events when Date range is used", () => {
    const floating = new JsCal.Event({
      uid: "e8",
      start: "2026-02-01T10:00:00",
    });
    const results = JsCal.filterByDateRange(
      [floating],
      { start: new Date("2026-02-01T01:00:00Z") },
    );
    expect(results.length).toBe(0);
  });

  it("handles Date range with task time zone", () => {
    const taskWithTz = new JsCal.Task({
      uid: "t3",
      start: "2026-02-01T10:00:00",
      timeZone: "Asia/Tokyo",
    });
    const results = JsCal.filterByDateRange(
      [taskWithTz],
      { start: new Date("2026-02-01T01:00:00Z"), end: new Date("2026-02-01T01:00:00Z") },
    );
    expect(results.map((item) => item.uid)).toEqual(["t3"]);
  });

  it("handles Date range for groups using entry time zones", () => {
    const group = new JsCal.Group({
      uid: "g3",
      entries: [
        new JsCal.Event({ uid: "e9", start: "2026-02-01T10:00:00", timeZone: "Asia/Tokyo" }).eject(),
      ],
    });
    const results = JsCal.filterByDateRange(
      [group],
      { start: new Date("2026-02-01T01:00:00Z"), end: new Date("2026-02-01T01:00:00Z") },
    );
    expect(results.map((item) => item.uid)).toEqual(["g3"]);
  });

  it("handles Date range for time zone events and tasks", () => {
    const utcEvent = new JsCal.Event({
      uid: "e10",
      start: "2026-02-01T10:00:00",
      timeZone: "Asia/Tokyo",
      duration: "PT1H",
    });
    const utcTask = new JsCal.Task({
      uid: "t5",
      start: "2026-02-01T10:00:00",
      timeZone: "Asia/Tokyo",
    });

    const results = filterByDateRange(
      [utcEvent.eject(), utcTask.eject()],
      { start: new Date("2026-02-01T01:00:00Z"), end: new Date("2026-02-01T01:00:00Z") },
    );
    expect(results.map((item) => item.uid).sort()).toEqual(["e10", "t5"]);
  });

  it("handles local duration without UTC end calculation", () => {
    const localEvent = new JsCal.Event({
      uid: "e5",
      start: "2026-02-01T10:00:00",
      duration: "PT1H",
    });

    const results = JsCal.filterByDateRange([localEvent], { end: "2026-02-01T09:00:00" });
    expect(results.length).toBe(0);
  });

  it("excludes items outside range bounds", () => {
    const utcEvent = new JsCal.Event({
      uid: "e6",
      start: "2026-02-01T10:00:00",
      duration: "PT1H",
    });

    const afterRange = filterByDateRange([utcEvent.eject()], { start: "2026-02-01T12:30:00" });
    expect(afterRange.length).toBe(0);

    const beforeRange = filterByDateRange([utcEvent.eject()], { end: "2026-02-01T09:30:00" });
    expect(beforeRange.length).toBe(0);
  });

  it("treats unknown types as incomparable", () => {
    const unknownObject = {
      "@type": "Unknown",
      uid: "u1",
      updated: "2026-02-01T00:00:00Z",
    };
    // @ts-expect-error unknown object type
    const results = filterByDateRange([unknownObject], { start: "2026-02-01T00:00:00Z" }, { includeIncomparable: true });
    expect(results.length).toBe(1);
  });

  it("handles Date range for unknown types", () => {
    const unknownObject = {
      "@type": "Unknown",
      uid: "u2",
      updated: "2026-02-01T00:00:00Z",
    };
    // @ts-expect-error unknown object type
    const included = filterByDateRange([unknownObject], { start: new Date("2026-02-01T00:00:00Z") }, { includeIncomparable: true });
    expect(included.length).toBe(1);
    // @ts-expect-error unknown object type
    const excluded = filterByDateRange([unknownObject], { start: new Date("2026-02-01T00:00:00Z") });
    expect(excluded.length).toBe(0);
  });

  it("handles Date range for local tasks as incomparable", () => {
    const localTask = new JsCal.Task({
      uid: "t4",
      start: "2026-02-01T10:00:00",
    });
    const included = JsCal.filterByDateRange([localTask], { start: new Date("2026-02-01T00:00:00Z") }, { includeIncomparable: true });
    expect(included.length).toBe(1);
    const excluded = JsCal.filterByDateRange([localTask], { start: new Date("2026-02-01T00:00:00Z") });
    expect(excluded.length).toBe(0);
  });

  it("handles incomparable date-times", () => {
    const results = filterByDateRange([event, task], {
      start: "2026-02-01T09:30:00",
      end: "2026-02-01T10:30:00",
    }, { includeIncomparable: true });
    expect(results.length).toBe(1);
  });
});
