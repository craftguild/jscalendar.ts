import { describe, expect, it } from "vitest";
import { JsCal, createUid } from "../jscal.js";

type EventInstance = InstanceType<typeof JsCal.Event>;

const fixedNow = () => "2026-02-01T00:00:00Z";

function makeEvent(): EventInstance {
  return new JsCal.Event(
    {
      title: "Kickoff",
      start: "2026-02-02T10:00:00",
    },
    { now: fixedNow },
  );
}

describe("JsCal.Event", () => {
  it("fills uid and updated", () => {
    const event = makeEvent();
    expect(event.data.uid).toBeTruthy();
    expect(event.data.updated).toBe("2026-02-01T00:00:00Z");
    expect(event.data["@type"]).toBe("Event");
    expect(event.data.sequence).toBe(0);
    expect(event.data.duration).toBe("PT0S");
    expect(event.data.status).toBe("confirmed");
    expect(event.data.created).toBe("2026-02-01T00:00:00Z");
    expect(event.data.descriptionContentType).toBe("text/plain");
    expect(event.data.showWithoutTime).toBe(false);
    expect(event.data.freeBusyStatus).toBe("busy");
    expect(event.data.privacy).toBe("public");
    expect(event.data.useDefaultAlerts).toBe(false);
    expect(event.data.excluded).toBe(false);
    expect(event.data.timeZone).toBeUndefined();
  });

  it("throws when required fields are missing", () => {
    expect(() => {
      // @ts-expect-error start is required
      new JsCal.Event({ title: "Missing start" }, { now: fixedNow });
    }).toThrow(/Event.start/);
  });

  it("accepts explicit @type", () => {
    const event = new JsCal.Event({ start: "2026-02-02T10:00:00" }, { now: fixedNow });
    expect(event.data["@type"]).toBe("Event");
  });

  it("accepts Date for start", () => {
    const event = new JsCal.Event({ start: new Date("2026-02-02T10:00:00") }, { now: fixedNow });
    expect(event.data.start).toBe("2026-02-02T10:00:00");
  });

  it("does not set timeZone when missing", () => {
    const event = new JsCal.Event({ start: new Date("2026-02-02T10:00:00") }, { now: fixedNow });
    expect(event.data.timeZone).toBeUndefined();
  });

  it("accepts duration in seconds", () => {
    const event = new JsCal.Event(
      { start: new Date("2026-02-02T10:00:00"), duration: 3600 },
      { now: fixedNow },
    );
    expect(event.data.duration).toBe("PT1H");
  });

  it("handles duration boundaries", () => {
    const zero = new JsCal.Event(
      { start: new Date("2026-02-02T10:00:00"), duration: 0 },
      { now: fixedNow },
    );
    expect(zero.data.duration).toBe("PT0S");

    const seconds = new JsCal.Event(
      { start: new Date("2026-02-02T10:00:00"), duration: 59 },
      { now: fixedNow },
    );
    expect(seconds.data.duration).toBe("PT59S");

    const negative = new JsCal.Event(
      { start: new Date("2026-02-02T10:00:00"), duration: -1 },
      { now: fixedNow },
    );
    expect(negative.data.duration).toBe("PT0S");
  });
});

describe("Event.update", () => {
  it("increments sequence on non-participant updates", () => {
    const event = makeEvent();
    event.update({ title: "Updated" }, { now: fixedNow });
    expect(event.data.sequence).toBe(1);
  });

  it("does not increment sequence when only participants change", () => {
    const event = makeEvent();
    const initialSequence = event.data.sequence ?? 0;
    event.addParticipant({ roles: { attendee: true }, email: "a@example.com" });
    expect(event.data.sequence ?? 0).toBe(initialSequence);
  });

  it("respects touch=false", () => {
    const event = makeEvent();
    const before = event.data.updated;
    event.update({ title: "No touch" }, { touch: false, now: () => "2026-02-02T00:00:00Z" });
    expect(event.data.updated).toBe(before);
  });
});

describe("Event.patch", () => {
  it("applies patch and updates metadata", () => {
    const event = makeEvent();
    event.patch({ title: "Patched" }, { now: fixedNow });
    expect(event.data.title).toBe("Patched");
    expect(event.data.updated).toBe("2026-02-01T00:00:00Z");
    expect(event.data.sequence).toBe(1);
  });

  it("does not increment sequence for participants-only patch", () => {
    const event = makeEvent();
    event.patch(
      {
        participants: {
          p1: {
            "@type": "Participant",
            roles: { attendee: true },
          },
        },
      },
      { now: fixedNow },
    );
    expect(event.data.sequence ?? 0).toBe(0);
  });
});

describe("createUid", () => {
  it("generates unique-ish id format", () => {
    const uid = createUid();
    expect(uid).toMatch(/^[0-9a-f-]{36}$/);
  });
});
