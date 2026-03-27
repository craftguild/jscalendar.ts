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
        const event = new JsCal.Event(
            { start: "2026-02-02T10:00:00" },
            { now: fixedNow },
        );
        expect(event.data["@type"]).toBe("Event");
    });

    it("accepts Date for start", () => {
        const event = new JsCal.Event(
            { start: new Date("2026-02-02T10:00:00") },
            { now: fixedNow },
        );
        expect(event.data.start).toBe("2026-02-02T10:00:00");
    });

    it("does not set timeZone when missing", () => {
        const event = new JsCal.Event(
            { start: new Date("2026-02-02T10:00:00") },
            { now: fixedNow },
        );
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

describe("Event.patch", () => {
    it("increments sequence on non-participant patches", () => {
        const event = makeEvent();
        const patched = event.patch(
            [{ op: "replace", path: "/title", value: "Updated" }],
            { now: fixedNow },
        );
        expect(patched.data.sequence).toBe(1);
        expect(event.data.sequence).toBe(0);
    });

    it("respects touch=false", () => {
        const event = makeEvent();
        const before = event.data.updated;
        const patched = event.patch(
            [{ op: "replace", path: "/title", value: "No touch" }],
            { touch: false, now: () => "2026-02-02T00:00:00Z" },
        );
        expect(patched.data.updated).toBe(before);
    });

    it("applies patch and updates metadata", () => {
        const event = makeEvent();
        const patched = event.patch(
            [{ op: "replace", path: "/title", value: "Patched" }],
            { now: fixedNow },
        );
        expect(patched.data.title).toBe("Patched");
        expect(patched.data.updated).toBe("2026-02-01T00:00:00Z");
        expect(patched.data.sequence).toBe(1);
    });

    it("allows patch to add nested maps with defaults", () => {
        const event = makeEvent();
        const patched = event.patch(
            [
                {
                    op: "add",
                    path: "/locations",
                    value: {
                        l1: {
                            "@type": "Location",
                            name: "Room A",
                        },
                    },
                },
                {
                    op: "add",
                    path: "/virtualLocations",
                    value: {
                        v1: {
                            "@type": "VirtualLocation",
                            uri: "https://example.com",
                        },
                    },
                },
                {
                    op: "add",
                    path: "/participants",
                    value: {
                        p1: {
                            "@type": "Participant",
                            roles: { attendee: true },
                            email: "a@example.com",
                        },
                    },
                },
                {
                    op: "add",
                    path: "/alerts",
                    value: {
                        a1: {
                            "@type": "Alert",
                            trigger: {
                                "@type": "AbsoluteTrigger",
                                when: "2026-02-01T01:00:00Z",
                            },
                        },
                    },
                },
                {
                    op: "add",
                    path: "/links",
                    value: {
                        link1: {
                            "@type": "Link",
                            href: "https://example.com",
                        },
                    },
                },
                {
                    op: "add",
                    path: "/relatedTo",
                    value: {
                        r1: {
                            "@type": "Relation",
                            relation: { parent: true },
                        },
                    },
                },
            ],
            { now: fixedNow },
        );
        expect(patched.data.locations?.l1?.name).toBe("Room A");
        expect(patched.data.virtualLocations?.v1?.uri).toBe(
            "https://example.com",
        );
        expect(patched.data.participants?.p1?.email).toBe("a@example.com");
        expect(patched.data.alerts?.a1?.trigger?.["@type"]).toBe(
            "AbsoluteTrigger",
        );
        expect(patched.data.links?.link1?.href).toBe("https://example.com");
        expect(patched.data.relatedTo?.r1?.relation?.parent).toBe(true);
    });

    it("increments sequence for participants-only patch", () => {
        const event = makeEvent();
        const patched = event.patch(
            [
                {
                    op: "add",
                    path: "/participants",
                    value: {
                        p1: {
                            "@type": "Participant",
                            roles: { attendee: true },
                        },
                    },
                },
            ],
            { now: fixedNow },
        );
        expect(patched.data.sequence ?? 0).toBe(1);
    });

    it("op: replace — overwrites an existing field", () => {
        const event = makeEvent();
        const patched = event.patch(
            [{ op: "replace", path: "/title", value: "Replaced" }],
            { now: fixedNow },
        );
        expect(patched.data.title).toBe("Replaced");
        expect(event.data.title).toBe("Kickoff"); // original unchanged
    });

    it("op: add — sets a new field that did not exist", () => {
        const event = makeEvent();
        const patched = event.patch(
            [
                {
                    op: "add",
                    path: "/locations",
                    value: { l1: { "@type": "Location", name: "Room A" } },
                },
            ],
            { now: fixedNow },
        );
        expect(patched.data.locations?.l1?.name).toBe("Room A");
        expect(event.data.locations).toBeUndefined(); // original unchanged
    });

    it("op: remove — deletes an existing field", () => {
        const base = new JsCal.Event(
            {
                title: "With desc",
                start: "2026-02-02T10:00:00",
                description: "to be removed",
            },
            { now: fixedNow },
        );
        const patched = base.patch([{ op: "remove", path: "/description" }], {
            now: fixedNow,
        });
        expect(patched.data.description).toBe("");
        expect(base.data.description).toBe("to be removed"); // original unchanged
    });

    it("op: move — moves a value from one path to another", () => {
        const base = new JsCal.Event(
            {
                title: "Original title",
                start: "2026-02-02T10:00:00",
                description: "Moved description",
            },
            { now: fixedNow },
        );
        const patched = base.patch(
            [{ op: "move", from: "/description", path: "/title" }],
            {
                now: fixedNow,
            },
        );
        expect(patched.data.title).toBe("Moved description");
        expect(patched.data.description).toBe("");
    });

    it("op: copy — copies a value without removing source", () => {
        const event = makeEvent();
        const patched = event.patch(
            [{ op: "copy", from: "/title", path: "/description" }],
            {
                now: fixedNow,
            },
        );
        expect(patched.data.title).toBe("Kickoff");
        expect(patched.data.description).toBe("Kickoff");
        expect(event.data.description).toBe(""); // original unchanged
    });

    it("op: test — validates current value before subsequent operations", () => {
        const event = makeEvent();
        const patched = event.patch(
            [
                { op: "test", path: "/title", value: "Kickoff" },
                { op: "replace", path: "/title", value: "After test" },
            ],
            { now: fixedNow },
        );
        expect(patched.data.title).toBe("After test");
    });

    it("throws when patch changes @type to a different JSCalendar object type", () => {
        const event = makeEvent();

        expect(() =>
            event.patch([{ op: "replace", path: "/@type", value: "Task" }], {
                now: fixedNow,
            }),
        ).toThrow();

        expect(event.data["@type"]).toBe("Event");
    });

    it("throws when patch result violates JSCalendar validation", () => {
        const event = makeEvent();

        expect(() =>
            event.patch([{ op: "remove", path: "/start" }], {
                now: fixedNow,
            }),
        ).toThrow();

        expect(event.data.start).toBe("2026-02-02T10:00:00");
        expect(event.data.sequence).toBe(0);
    });
});

describe("createUid", () => {
    it("generates unique-ish id format", () => {
        const uid = createUid();
        expect(uid).toMatch(/^[0-9a-f-]{36}$/);
    });
});
