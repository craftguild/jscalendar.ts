import { describe, expect, it } from "vitest";
import { JsCal, ValidationError } from "../index.js";

describe("validation", () => {
    it("rejects LocalDateTime with time zone offset", () => {
        expect(
            () => new JsCal.Event({ start: "2026-02-01T10:00:00Z" }),
        ).toThrowError("object.start: must not include time zone offset");
    });

    it("rejects UTCDateTime with trailing zero fractional seconds", () => {
        expect(
            () =>
                new JsCal.Event({
                    start: "2026-02-01T10:00:00",
                    updated: "2026-02-01T00:00:00.120Z",
                }),
        ).toThrowError(
            "object.updated: fractional seconds must not have trailing zeros",
        );
    });

    it("rejects invalid description content type", () => {
        expect(
            () =>
                new JsCal.Event({
                    start: "2026-02-01T10:00:00",
                    descriptionContentType: "application/json",
                }),
        ).toThrowError(
            "object.descriptionContentType: must be a text/* media type",
        );
    });

    it("rejects non-utf8 charset parameters", () => {
        expect(
            () =>
                new JsCal.Event({
                    start: "2026-02-01T10:00:00",
                    descriptionContentType: "text/plain; charset=ascii",
                }),
        ).toThrowError(
            "object.descriptionContentType: charset parameter must be utf-8",
        );
    });

    it("allows validation to be disabled for create and patch", () => {
        const event = new JsCal.Event(
            { start: "2026-02-01T10:00:00Z" },
            { validate: false },
        );

        expect(event.get("start")).toBe("2026-02-01T10:00:00Z");

        event.patch({ start: "2026-02-01T10:00:00Z" }, { validate: false });
    });

    it("throws ValidationError with path and message", () => {
        expect(
            () => new JsCal.Event({ start: "2026-02-01T10:00:00Z" }),
        ).toThrowError(ValidationError);
    });

    it("accepts nested objects with valid ids and media types", () => {
        const event = new JsCal.Event({
            uid: "evt_1",
            start: "2026-02-01T10:00:00",
            descriptionContentType: "text/plain; charset=utf-8",
            locations: {
                loc1: { "@type": "Location", name: "Room A" },
            },
            virtualLocations: {
                v1: { "@type": "VirtualLocation", uri: "https://example.com" },
            },
            links: {
                l1: {
                    "@type": "Link",
                    href: "https://example.com",
                    contentType: "text/plain; charset=utf-8",
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
                    trigger: { "@type": "OffsetTrigger", offset: "-PT15M" },
                },
            },
            relatedTo: {
                rel1: { "@type": "Relation", relation: { first: true } },
            },
        });

        expect(event.get("uid")).toBe("evt_1");
    });

    it("rejects invalid map key ids", () => {
        expect(
            () =>
                new JsCal.Event({
                    start: "2026-02-01T10:00:00",
                    locations: {
                        "bad id": { "@type": "Location", name: "Room A" },
                    },
                }),
        ).toThrowError(
            "object.locations.bad id: must use base64url characters",
        );
    });

    it("rejects invalid content-id formats", () => {
        expect(
            () =>
                new JsCal.Event({
                    start: "2026-02-01T10:00:00",
                    links: {
                        l1: {
                            "@type": "Link",
                            href: "https://example.com",
                            cid: "<a@example.com",
                        },
                    },
                }),
        ).toThrowError("object.links.l1.cid: must use matching angle brackets");
    });

    it("rejects boolean map entries that are not true", () => {
        expect(
            () =>
                new JsCal.Event({
                    start: "2026-02-01T10:00:00",
                    participants: {
                        // Intentionally violate the BooleanMap type to assert validation errors.
                        p1: {
                            "@type": "Participant",
                            roles: { attendee: false } as unknown as {
                                [key: string]: true;
                            },
                        },
                    },
                }),
        ).toThrowError("object.participants.p1.roles.attendee: must be true");
    });

    it("rejects participants without roles", () => {
        expect(
            () =>
                new JsCal.Event({
                    start: "2026-02-01T10:00:00",
                    participants: {
                        p1: {
                            "@type": "Participant",
                            name: "Alice",
                        } as unknown as import("../types.js").Participant,
                    },
                }),
        ).toThrowError("object.participants.p1.roles: is required");
    });

    it("rejects participants with empty roles", () => {
        expect(
            () =>
                new JsCal.Event({
                    start: "2026-02-01T10:00:00",
                    participants: {
                        p1: { "@type": "Participant", roles: {} },
                    },
                }),
        ).toThrowError(
            "object.participants.p1.roles: must include at least one role",
        );
    });

    it("rejects invalid time zone ids", () => {
        expect(
            () =>
                new JsCal.Event({
                    start: "2026-02-01T10:00:00",
                    // Intentionally bypass TimeZoneInput typing to test invalid IDs.
                    timeZone:
                        "Mars/Phobos" as unknown as import("../types.js").TimeZoneInput,
                }),
        ).toThrowError("Unknown time zone: Mars/Phobos");
    });

    it("rejects invalid recurrence rule values", () => {
        expect(
            () =>
                new JsCal.Event({
                    start: "2026-02-01T10:00:00",
                    recurrenceRules: [
                        {
                            "@type": "RecurrenceRule",
                            frequency: "daily",
                            byMonthDay: [0],
                        },
                    ],
                }),
        ).toThrowError(
            "object.recurrenceRules[0].byMonthDay[0]: must be an integer between -31 and 31, excluding 0",
        );
    });

    it("accepts extended common fields and nested validation", () => {
        const event = new JsCal.Event({
            start: "2026-02-01T10:00:00",
            method: "publish",
            keywords: { sprint: true },
            categories: { meeting: true },
            relatedTo: {
                rel1: { "@type": "Relation", relation: { parent: true } },
            },
            replyTo: {
                "mailto:team@example.com": "mailto:team@example.com",
            },
            locations: {
                loc1: {
                    "@type": "Location",
                    name: "Room A",
                    links: {
                        link1: { "@type": "Link", href: "https://example.com" },
                    },
                },
            },
            virtualLocations: {
                v1: {
                    "@type": "VirtualLocation",
                    uri: "https://example.com",
                    features: { chat: true },
                },
            },
            participants: {
                p1: {
                    "@type": "Participant",
                    roles: { attendee: true },
                    sendTo: { imap: "mailto:a@example.com" },
                    kind: "individual",
                },
            },
            alerts: {
                a1: {
                    "@type": "Alert",
                    trigger: {
                        "@type": "AbsoluteTrigger",
                        when: "2026-02-01T00:00:00Z",
                    },
                },
            },
            localizations: {
                en: { title: "Localized", keywords: { a: true } },
            },
            recurrenceOverrides: {
                "2026-02-02T10:00:00": {
                    title: null,
                    locations: {
                        loc1: { "@type": "Location", name: "Room A" },
                    },
                },
            },
            timeZones: {
                "Asia/Tokyo": {
                    "@type": "TimeZone",
                    tzId: "Asia/Tokyo",
                    aliases: { JST: true },
                    standard: [
                        {
                            "@type": "TimeZoneRule",
                            start: "2026-01-01T00:00:00",
                            offsetFrom: "+09:00",
                            offsetTo: "+09:00",
                            comments: ["note"],
                        },
                    ],
                    daylight: [
                        {
                            "@type": "TimeZoneRule",
                            start: "2026-06-01T00:00:00",
                            offsetFrom: "+09:00",
                            offsetTo: "+10:00",
                        },
                    ],
                },
            },
        });

        expect(event.get("method")).toBe("publish");
    });

    it("rejects non-gregorian rscale values", () => {
        expect(
            () =>
                new JsCal.Event({
                    start: "2026-02-01T10:00:00",
                    recurrenceRules: [
                        {
                            "@type": "RecurrenceRule",
                            frequency: "daily",
                            rscale: "hebrew",
                        },
                    ],
                }),
        ).toThrowError(
            "object.recurrenceRules[0].rscale: only gregorian is supported",
        );
    });

    it("accepts time zone objects", () => {
        const event = new JsCal.Event({
            start: "2026-02-01T10:00:00",
            timeZones: {
                "Asia/Tokyo": {
                    "@type": "TimeZone",
                    tzId: "Asia/Tokyo",
                    standard: [
                        {
                            "@type": "TimeZoneRule",
                            start: "2026-01-01T00:00:00",
                            offsetFrom: "+09:00",
                            offsetTo: "+09:00",
                        },
                    ],
                },
            },
        });

        expect(event.get("timeZones")?.["Asia/Tokyo"]?.tzId).toBe("Asia/Tokyo");
    });
});
