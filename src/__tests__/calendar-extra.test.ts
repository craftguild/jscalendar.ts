import { describe, expect, it } from "vitest";
import { JsCal, createId, isEvent, isGroup, isTask } from "../jscal.js";

const fixedNow = () => "2026-02-01T00:00:00Z";

function makeEvent(): InstanceType<typeof JsCal.Event> {
  return new JsCal.Event(
    {
      title: "Kickoff",
      start: "2026-02-02T10:00:00",
    },
    { now: fixedNow },
  );
}

describe("JsCal helpers", () => {
  it("creates group and adds entry", () => {
    const group = new JsCal.Group({ entries: [] }, { now: fixedNow });

    const event = makeEvent();
    group.addEntry(event.data);
    expect(group.data.entries.length).toBe(1);
  });

  it("does not expose addEntry on non-group", () => {
    const event = makeEvent();
    expect("addEntry" in event).toBe(false);
  });

  it("adds locations and virtual locations", () => {
    const event = makeEvent();
    const locId = event.addLocation({ name: "Room A" });
    const vlocId = event.addVirtualLocation({ name: "Zoom", uri: "https://example.com" });
    const locations = event.data.locations;
    const virtualLocations = event.data.virtualLocations;
    expect(locations).toBeDefined();
    expect(virtualLocations).toBeDefined();
    if (!locations || !virtualLocations) throw new Error("Missing locations");
    expect(locations[locId]?.name).toBe("Room A");
    expect(virtualLocations[vlocId]?.uri).toBe("https://example.com");
  });

  it("adds participants and alerts", () => {
    const event = makeEvent();
    const participantId = event.addParticipant({ roles: { attendee: true }, email: "a@example.com" });
    const alertId = event.addAlert({ trigger: { "@type": "AbsoluteTrigger", when: "2026-02-01T01:00:00Z" } });
    const participants = event.data.participants;
    const alerts = event.data.alerts;
    expect(participants).toBeDefined();
    expect(alerts).toBeDefined();
    if (!participants || !alerts) throw new Error("Missing participants/alerts");
    expect(participants[participantId]?.email).toBe("a@example.com");
    expect(alerts[alertId]?.trigger).toBeTruthy();
    expect(participants[participantId]?.participationStatus).toBe("needs-action");
    expect(participants[participantId]?.expectReply).toBe(false);
    expect(participants[participantId]?.scheduleAgent).toBe("server");
    expect(participants[participantId]?.scheduleForceSend).toBe(false);
    expect(participants[participantId]?.scheduleSequence).toBe(0);
    expect(alerts[alertId]?.action).toBe("display");
  });

  it("defaults relativeTo for offset triggers", () => {
    const event = makeEvent();
    const alertId = event.addAlert({ trigger: { "@type": "OffsetTrigger", offset: "PT15M" } });
    const alerts = event.data.alerts;
    expect(alerts).toBeDefined();
    if (!alerts) throw new Error("Missing alerts");
    const trigger = alerts[alertId]?.trigger;
    if (!trigger || trigger["@type"] !== "OffsetTrigger") throw new Error("Missing trigger");
    expect(trigger.relativeTo).toBe("start");
  });

  it("updates sequence for alerts but not for participants", () => {
    const event = makeEvent();
    const initialSequence = event.data.sequence ?? 0;
    event.addParticipant({ roles: { attendee: true }, email: "a@example.com" });
    expect(event.data.sequence ?? 0).toBe(initialSequence);
    event.addAlert({ trigger: { "@type": "AbsoluteTrigger", when: "2026-02-01T01:00:00Z" } });
    expect(event.data.sequence ?? 0).toBe(initialSequence + 1);
  });

  it("clones and eject return deep copies", () => {
    const event = makeEvent();
    const clone = event.clone();
    clone.data.title = "Changed";
    expect(event.data.title).toBe("Kickoff");

    const json = event.eject();
    json.title = "Changed";
    expect(event.data.title).toBe("Kickoff");
  });

  it("createId returns base64url without padding", () => {
    const id = createId();
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(id).not.toContain("=");
  });

  it("supports task creation", () => {
    const task = new JsCal.Task(
      {
        title: "Do work",
        start: "2026-02-02T10:00:00",
      },
      { now: fixedNow },
    );
    expect(task.data["@type"]).toBe("Task");
    expect(task.data.created).toBe("2026-02-01T00:00:00Z");
  });

  it("supports group creation", () => {
    const group = new JsCal.Group({ entries: [] }, { now: fixedNow });
    expect(group.data["@type"]).toBe("Group");
    expect(group.data.created).toBe("2026-02-01T00:00:00Z");
  });

  it("accepts Date inputs and null time zones", () => {
    const start = new Date("2026-02-02T10:00:00");
    const event = new JsCal.Event({ title: "Date input", start, timeZone: null }, { now: fixedNow });
    expect(event.data.start).toMatch(/^2026-02-02T/);
    expect(event.data.timeZone).toBeNull();

    const task = new JsCal.Task({ title: "No TZ", start, timeZone: null }, { now: fixedNow });
    expect(task.data.timeZone).toBeNull();
  });

  it("accepts Date inputs for updated/created", () => {
    const updated = new Date("2026-02-02T10:00:00Z");
    const created = new Date("2026-02-01T09:00:00Z");
    const event = new JsCal.Event({
      title: "Dates",
      start: "2026-02-02T10:00:00",
      updated,
      created,
    });
    expect(event.data.updated).toBe("2026-02-02T10:00:00Z");
    expect(event.data.created).toBe("2026-02-01T09:00:00Z");
  });

  it("rejects invalid event start", () => {
    expect(() => new JsCal.Event({ title: "Bad", start: "" })).toThrow();
  });

  it("resolves task time zones", () => {
    const task = new JsCal.Task({ title: "TZ", start: "2026-02-02T10:00:00", timeZone: "asia/tokyo" }, { now: fixedNow });
    expect(task.data.timeZone).toBe("Asia/Tokyo");
  });

  it("derives task progress from participant statuses", () => {
    const completed = new JsCal.Task({
      title: "Completed",
      participants: {
        p1: { "@type": "Participant", roles: { attendee: true }, progress: "completed" },
      },
    }, { now: fixedNow });
    expect(completed.data.progress).toBe("completed");

    const failed = new JsCal.Task({
      title: "Failed",
      participants: {
        p1: { "@type": "Participant", roles: { attendee: true }, progress: "failed" },
      },
    }, { now: fixedNow });
    expect(failed.data.progress).toBe("failed");

    const inProcess = new JsCal.Task({
      title: "In process",
      participants: {
        p1: { "@type": "Participant", roles: { attendee: true }, progress: "in-process" },
      },
    }, { now: fixedNow });
    expect(inProcess.data.progress).toBe("in-process");

    const fallback = new JsCal.Task({
      title: "Fallback",
      participants: {
        p1: { "@type": "Participant", roles: { attendee: true }, progress: "delegated" },
      },
    }, { now: fixedNow });
    expect(fallback.data.progress).toBe("needs-action");
  });

  it("clones task and group objects", () => {
    const task = new JsCal.Task({ title: "Task", start: "2026-02-02T10:00:00" }, { now: fixedNow });
    const taskClone = task.clone();
    taskClone.data.title = "Changed";
    expect(task.data.title).toBe("Task");

    const group = new JsCal.Group({ entries: [] }, { now: fixedNow });
    const groupClone = group.clone();
    groupClone.data.title = "Changed";
    expect(group.data.title).toBe("");
  });

  it("requires entries for group creation", () => {
    // @ts-expect-error entries are required
    expect(() => new JsCal.Group({})).toThrow();
  });

  it("supports get/set helpers", () => {
    const event = makeEvent();
    expect(event.get("title")).toBe("Kickoff");
    event.set("title", "Updated");
    expect(event.get("title")).toBe("Updated");
  });

  it("exposes type guards", () => {
    const event = makeEvent().eject();
    const task = new JsCal.Task({ title: "Task", start: "2026-02-02T10:00:00" }).eject();
    const group = new JsCal.Group({ entries: [] }).eject();
    expect(isEvent(event)).toBe(true);
    expect(isTask(task)).toBe(true);
    expect(isGroup(group)).toBe(true);
  });
});
