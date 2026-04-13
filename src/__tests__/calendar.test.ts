import { describe, expect, it } from "vitest";
import { JsCal, createUid } from "../jscal.js";

type EventInstance = InstanceType<typeof JsCal.Event>;

const fixedNow = () => "2026-02-01T00:00:00Z";

/**
 * Create a fixed event for patch tests.
 * @return Event instance.
 */
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
        const seconds = new JsCal.Event(
            { start: new Date("2026-02-02T10:00:00"), duration: 59 },
            { now: fixedNow },
        );
        const negative = new JsCal.Event(
            { start: new Date("2026-02-02T10:00:00"), duration: -1 },
            { now: fixedNow },
        );
        expect(zero.data.duration).toBe("PT0S");
        expect(seconds.data.duration).toBe("PT59S");
        expect(negative.data.duration).toBe("PT0S");
    });
});

describe("Event.patch", () => {
    it("increments sequence on patches", () => {
        const event = makeEvent();
        const patched = event.patch({ title: "Updated" }, { now: fixedNow });
        expect(patched.data.sequence).toBe(1);
        expect(event.data.sequence).toBe(0);
    });

    it("respects touch=false", () => {
        const event = makeEvent();
        const before = event.data.updated;
        const patched = event.patch({ title: "No touch" }, { touch: false });
        expect(patched.data.updated).toBe(before);
    });

    it("applies root property patches and updates metadata", () => {
        const event = makeEvent();
        const patched = event.patch({ title: "Patched" }, { now: fixedNow });
        expect(patched.data.title).toBe("Patched");
        expect(patched.data.updated).toBe("2026-02-01T00:00:00Z");
        expect(patched.data.sequence).toBe(1);
    });

    it("adds nested maps with root PatchObject entries", () => {
        const event = makeEvent();
        const patched = event.patch(
            {
                locations: {
                    l1: { "@type": "Location", name: "Room A" },
                },
                virtualLocations: {
                    v1: {
                        "@type": "VirtualLocation",
                        uri: "https://example.com",
                    },
                },
                participants: {
                    p1: {
                        "@type": "Participant",
                        roles: { attendee: true },
                        email: "a@example.com",
                    },
                },
                alerts: {
                    a1: {
                        "@type": "Alert",
                        trigger: {
                            "@type": "AbsoluteTrigger",
                            when: "2026-02-01T01:00:00Z",
                        },
                    },
                },
                links: {
                    link1: { "@type": "Link", href: "https://example.com" },
                },
                relatedTo: {
                    r1: { "@type": "Relation", relation: { parent: true } },
                },
            },
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

    it("updates nested fields using PatchObject paths", () => {
        const event = new JsCal.Event(
            {
                start: "2026-02-02T10:00:00",
                participants: {
                    p1: {
                        "@type": "Participant",
                        roles: { attendee: true },
                        name: "Before",
                    },
                },
            },
            { now: fixedNow },
        );
        const patched = event.patch(
            { "participants/p1/name": "After" },
            { now: fixedNow },
        );
        expect(patched.data.participants?.p1?.name).toBe("After");
        expect(event.data.participants?.p1?.name).toBe("Before");
    });

    it("updates participant fields after adding a participant map", () => {
        const event = makeEvent();
        const withParticipants = event.patch(
            {
                participants: JsCal.participants([
                    {
                        id: "p1",
                        value: {
                            roles: { "xxx.yyy:yyy": true },
                            name: "test",
                        },
                    },
                ]),
            },
            { now: fixedNow },
        );
        const updated = withParticipants.patch(
            { "/participants/p1/name": "test2" },
            { now: fixedNow },
        );

        expect(withParticipants.data.participants?.p1?.name).toBe("test");
        expect(updated.data.participants?.p1?.name).toBe("test2");
        expect(updated.data.participants?.p1?.roles).toEqual({
            "xxx.yyy:yyy": true,
        });
    });

    it("applies repeated mixed root and nested PatchObject updates", () => {
        const event = makeEvent();
        const first = event.patch(
            {
                title: "Phase 1",
                description: "initial description",
                participants: JsCal.participants([
                    {
                        id: "p1",
                        value: {
                            roles: { attendee: true },
                            name: "Alice",
                            email: "alice@example.com",
                        },
                    },
                    {
                        id: "p2",
                        value: {
                            roles: { optional: true, attendee: true },
                            name: "Bob",
                        },
                    },
                ]),
                locations: JsCal.locations([
                    {
                        id: "room",
                        value: {
                            name: "Room A",
                            description: "first floor",
                        },
                    },
                ]),
            },
            { now: fixedNow },
        );
        const second = first.patch(
            {
                title: "Phase 2",
                "participants/p1/name": "Alice Updated",
                "participants/p2/email": "bob@example.com",
                "locations/room/name": "Room B",
            },
            { now: fixedNow },
        );
        const third = second.patch(
            {
                description: null,
                participants: JsCal.participants([
                    {
                        id: "p1",
                        value: {
                            roles: { chair: true },
                            name: "Chair Alice",
                            email: "chair@example.com",
                        },
                    },
                    {
                        id: "p3",
                        value: {
                            roles: { "xxx.yyy:reviewer": true },
                            name: "Carol",
                        },
                    },
                ]),
                "locations/room/description": "second floor",
            },
            { now: fixedNow },
        );
        const fourth = third.patch(
            {
                "participants/p1/name": "Final Alice",
                "participants/p3/email": "carol@example.com",
                "locations/room/name": "Room C",
                title: "Final title",
            },
            { now: fixedNow },
        );

        expect(event.data.title).toBe("Kickoff");
        expect(event.data.participants).toBeUndefined();
        expect(first.data.title).toBe("Phase 1");
        expect(first.data.description).toBe("initial description");
        expect(first.data.participants?.p1?.name).toBe("Alice");
        expect(first.data.participants?.p2?.email).toBeUndefined();
        expect(first.data.locations?.room?.name).toBe("Room A");
        expect(first.data.sequence).toBe(1);

        expect(second.data.title).toBe("Phase 2");
        expect(second.data.description).toBe("initial description");
        expect(second.data.participants?.p1?.name).toBe("Alice Updated");
        expect(second.data.participants?.p1?.email).toBe("alice@example.com");
        expect(second.data.participants?.p2?.email).toBe("bob@example.com");
        expect(second.data.locations?.room?.name).toBe("Room B");
        expect(second.data.locations?.room?.description).toBe("first floor");
        expect(second.data.sequence).toBe(2);

        expect(third.data.title).toBe("Phase 2");
        expect(third.data.description).toBe("");
        expect(third.data.participants?.p1?.roles).toEqual({ chair: true });
        expect(third.data.participants?.p1?.name).toBe("Chair Alice");
        expect(third.data.participants?.p2).toBeUndefined();
        expect(third.data.participants?.p3?.name).toBe("Carol");
        expect(third.data.locations?.room?.name).toBe("Room B");
        expect(third.data.locations?.room?.description).toBe("second floor");
        expect(third.data.sequence).toBe(3);

        expect(fourth.data.title).toBe("Final title");
        expect(fourth.data.description).toBe("");
        expect(fourth.data.participants?.p1?.name).toBe("Final Alice");
        expect(fourth.data.participants?.p1?.email).toBe("chair@example.com");
        expect(fourth.data.participants?.p3?.email).toBe("carol@example.com");
        expect(fourth.data.participants?.p3?.roles).toEqual({
            "xxx.yyy:reviewer": true,
        });
        expect(fourth.data.locations?.room?.name).toBe("Room C");
        expect(fourth.data.locations?.room?.description).toBe("second floor");
        expect(fourth.data.sequence).toBe(4);
    });

    it("applies a diff PatchObject directly", () => {
        const before = new JsCal.Event(
            {
                uid: "diff-before",
                title: "Before",
                start: "2026-02-02T10:00:00",
                participants: {
                    p1: {
                        "@type": "Participant",
                        roles: { attendee: true },
                        name: "Alice",
                    },
                    p2: {
                        "@type": "Participant",
                        roles: { optional: true },
                        name: "Bob",
                    },
                },
                locations: {
                    room: {
                        "@type": "Location",
                        name: "Room A",
                    },
                },
                recurrenceRules: [
                    { "@type": "RecurrenceRule", frequency: "daily" },
                ],
            },
            { now: fixedNow },
        );
        const after = new JsCal.Event(
            {
                uid: "diff-before",
                title: "After",
                start: "2026-02-02T10:00:00",
                participants: {
                    p1: {
                        "@type": "Participant",
                        roles: { attendee: true },
                        name: "Alice Updated",
                    },
                    p3: {
                        "@type": "Participant",
                        roles: { "xxx.yyy:reviewer": true },
                        name: "Carol",
                    },
                },
                locations: {
                    room: {
                        "@type": "Location",
                        name: "Room B",
                    },
                },
                recurrenceRules: [
                    { "@type": "RecurrenceRule", frequency: "weekly" },
                ],
            },
            { now: fixedNow },
        );

        const patch = JsCal.diff(before, after);
        const patched = before.patch(patch, { now: fixedNow });

        expect(patch).toEqual({
            "participants/p1/name": "Alice Updated",
            "participants/p2": null,
            "participants/p3": {
                "@type": "Participant",
                name: "Carol",
                roles: { "xxx.yyy:reviewer": true },
            },
            "locations/room/name": "Room B",
            recurrenceRules: [
                { "@type": "RecurrenceRule", frequency: "weekly" },
            ],
            title: "After",
        });
        expect(patched.data.title).toBe(after.data.title);
        expect(patched.data.participants).toEqual(after.data.participants);
        expect(patched.data.locations).toEqual(after.data.locations);
        expect(patched.data.recurrenceRules).toEqual(
            after.data.recurrenceRules,
        );
        expect(before.data.participants?.p1?.name).toBe("Alice");
    });

    it("deletes a field when the patch value is null", () => {
        const event = new JsCal.Event(
            {
                title: "With desc",
                start: "2026-02-02T10:00:00",
                description: "to be removed",
            },
            { now: fixedNow },
        );
        const patched = event.patch({ description: null }, { now: fixedNow });
        expect(patched.data.description).toBe("");
        expect(event.data.description).toBe("to be removed");
    });

    it("throws when a nested PatchObject path is missing", () => {
        const event = makeEvent();
        expect(() =>
            event.patch({ "participants/p1/name": "Alice" }, { now: fixedNow }),
        ).toThrow("Patch pointer missing path: /participants/p1/name");
    });

    it("throws when PatchObject entries have prefix conflicts", () => {
        const event = makeEvent();
        expect(() =>
            event.patch(
                {
                    participants: {
                        p1: {
                            "@type": "Participant",
                            roles: { attendee: true },
                        },
                    },
                    "participants/p1/name": "Alice",
                },
                { now: fixedNow },
            ),
        ).toThrow(
            "Patch pointer conflict: /participants is prefix of /participants/p1/name",
        );
    });

    it("throws when patch changes @type to a different object type", () => {
        const event = makeEvent();
        expect(() =>
            event.patch({ "@type": "Task" } as never, { now: fixedNow }),
        ).toThrow();
        expect(event.data["@type"]).toBe("Event");
    });

    it("throws when diffing different JSCalendar object types", () => {
        const task = new JsCal.Task({}, { now: fixedNow });
        const event = makeEvent();
        const diff = JsCal.diff as (
            before: { data: import("../types.js").JSCalendarObject },
            after: { data: import("../types.js").JSCalendarObject },
        ) => import("../types.js").PatchObject;

        expect(() => diff(task, event)).toThrow(
            "Cannot diff Task against Event",
        );
    });

    it("types reject diffing different JSCalendar object types", () => {
        if (false) {
            const task = new JsCal.Task({}, { now: fixedNow });
            const event = makeEvent();
            // @ts-expect-error diff inputs must have the same @type.
            JsCal.diff(task, event);
        }
        expect(true).toBe(true);
    });

    it("throws when patch result violates JSCalendar validation", () => {
        const event = makeEvent();
        expect(() => event.patch({ start: null }, { now: fixedNow })).toThrow();
        expect(event.data.start).toBe("2026-02-02T10:00:00");
        expect(event.data.sequence).toBe(0);
    });

    it("throws when patch traverses arrays", () => {
        const event = new JsCal.Event(
            {
                start: "2026-02-02T10:00:00",
                recurrenceRules: [
                    { "@type": "RecurrenceRule", frequency: "daily" },
                ],
            },
            { now: fixedNow },
        );
        expect(() =>
            event.patch(
                { "recurrenceRules/0/frequency": "weekly" },
                { now: fixedNow },
            ),
        ).toThrow("Patch pointer references into array");
    });

    it("replaces arrays in their entirety", () => {
        const event = new JsCal.Event(
            {
                start: "2026-02-02T10:00:00",
                recurrenceRules: [
                    { "@type": "RecurrenceRule", frequency: "daily" },
                ],
            },
            { now: fixedNow },
        );

        const patched = event.patch(
            {
                recurrenceRules: [
                    { "@type": "RecurrenceRule", frequency: "weekly" },
                ],
            },
            { now: fixedNow },
        );

        expect(patched.data.recurrenceRules).toEqual([
            { "@type": "RecurrenceRule", frequency: "weekly" },
        ]);
        expect(event.data.recurrenceRules).toEqual([
            { "@type": "RecurrenceRule", frequency: "daily" },
        ]);
    });

    it("diff replaces arrays in their entirety", () => {
        const before = new JsCal.Event(
            {
                uid: "array-diff",
                start: "2026-02-02T10:00:00",
                recurrenceRules: [
                    { "@type": "RecurrenceRule", frequency: "daily" },
                ],
            },
            { now: fixedNow },
        );
        const after = new JsCal.Event(
            {
                uid: "array-diff",
                start: "2026-02-02T10:00:00",
                recurrenceRules: [
                    { "@type": "RecurrenceRule", frequency: "weekly" },
                ],
            },
            { now: fixedNow },
        );

        expect(JsCal.diff(before, after)).toEqual({
            recurrenceRules: [
                { "@type": "RecurrenceRule", frequency: "weekly" },
            ],
        });
    });

    it("throws when patch adds an unknown JSCalendar property", () => {
        const event = makeEvent();
        expect(() =>
            event.patch({ itle: "Updated" }, { now: fixedNow } as never),
        ).toThrow("object.itle: is not a known JSCalendar property");
        expect(event.data.title).toBe("Kickoff");
    });
});

describe("createUid", () => {
    it("generates unique-ish id format", () => {
        const uid = createUid();
        expect(uid).toMatch(/^[0-9a-f-]{36}$/);
    });
});
