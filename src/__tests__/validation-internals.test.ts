import { describe, expect, it } from "vitest";
import { JsCal } from "../jscal.js";
import {
    buildEventPatch,
    buildGroupPatch,
    buildTaskPatch,
} from "../jscal/builders.js";
import { assertJsonValue, assertPatchObject } from "../validate/asserts.js";
import {
    validateAlert,
    validateCommon,
    validateLocation,
    validateParticipant,
} from "../validate/validators-common.js";
import {
    validateNDay,
    validateRecurrenceRule,
} from "../validate/validators-recurrence.js";

describe("validation internals", () => {
    it("accepts rich common objects and nested validators", () => {
        expect(() =>
            validateCommon(
                {
                    "@type": "Event",
                    uid: "evt-1",
                    updated: "2026-02-01T00:00:00Z",
                    start: "2026-02-01T09:00:00",
                    created: "2026-01-31T00:00:00Z",
                    sequence: 1,
                    method: "publish",
                    title: "Review",
                    description: "Agenda",
                    descriptionContentType: "text/plain; charset=utf-8",
                    showWithoutTime: false,
                    relatedTo: {
                        parent: {
                            "@type": "Relation",
                            relation: { first: true },
                        },
                    },
                    keywords: { sprint: true },
                    categories: { planning: true },
                    color: "#123456",
                    recurrenceId: "2026-02-02T09:00:00",
                    recurrenceIdTimeZone: "Asia/Tokyo",
                    recurrenceRules: [
                        {
                            "@type": "RecurrenceRule",
                            frequency: "weekly",
                            byDay: [
                                { "@type": "NDay", day: "mo", nthOfPeriod: 1 },
                            ],
                            byMonthDay: [1, -1],
                            byMonth: ["1", "12"],
                            byYearDay: [1, -1],
                            byWeekNo: [1, -1],
                            byHour: [9, 17],
                            byMinute: [0, 30],
                            bySecond: [0, 15],
                            bySetPosition: [1, -1],
                            interval: 2,
                            count: 4,
                            skip: "forward",
                            firstDayOfWeek: "mo",
                            until: "2026-03-01T09:00:00",
                        },
                    ],
                    excludedRecurrenceRules: [
                        {
                            "@type": "RecurrenceRule",
                            frequency: "daily",
                            count: 1,
                        },
                    ],
                    recurrenceOverrides: {
                        "2026-02-09T09:00:00": {
                            title: "Shifted",
                            priority: 3,
                        },
                    },
                    excluded: false,
                    priority: 1,
                    freeBusyStatus: "busy",
                    privacy: "public",
                    replyTo: { organizer: "mailto:team@example.com" },
                    sentBy: "mailto:bot@example.com",
                    locations: {
                        loc1: {
                            "@type": "Location",
                            name: "Room A",
                            description: "Floor 3",
                            locationTypes: { conference: true },
                            relativeTo: "loc-parent",
                            timeZone: "Asia/Tokyo",
                            coordinates: "geo:35.0,139.0",
                            links: {
                                link1: {
                                    "@type": "Link",
                                    href: "https://example.com/map",
                                },
                            },
                        },
                    },
                    virtualLocations: {
                        v1: {
                            "@type": "VirtualLocation",
                            name: "Meet",
                            description: "Online",
                            uri: "https://example.com/meet",
                            features: { chat: true },
                        },
                    },
                    links: {
                        l1: {
                            "@type": "Link",
                            href: "https://example.com/doc",
                            cid: "<doc@example.com>",
                            contentType: "text/plain; charset=utf-8",
                            size: 12,
                            rel: "describedby",
                            display: "badge",
                            title: "Doc",
                        },
                    },
                    participants: {
                        p1: {
                            "@type": "Participant",
                            name: "Alice",
                            email: "alice@example.com",
                            description: "Owner",
                            sendTo: { imip: "mailto:alice@example.com" },
                            kind: "individual",
                            roles: { attendee: true },
                            locationId: "loc1",
                            language: "en",
                            participationStatus: "accepted",
                            participationComment: "ok",
                            expectReply: true,
                            scheduleAgent: "server",
                            scheduleForceSend: false,
                            scheduleSequence: 1,
                            scheduleStatus: ["2.0;Success"],
                            scheduleUpdated: "2026-02-01T00:00:00Z",
                            sentBy: "mailto:assistant@example.com",
                            invitedBy: "inviter",
                            delegatedTo: { delegate1: true },
                            delegatedFrom: { delegator1: true },
                            memberOf: { team1: true },
                            links: {
                                link1: {
                                    "@type": "Link",
                                    href: "https://example.com/profile",
                                },
                            },
                            progress: "in-process",
                            progressUpdated: "2026-02-01T00:00:00Z",
                            percentComplete: 50,
                        },
                    },
                    requestStatus: "2.0;Success",
                    useDefaultAlerts: false,
                    alerts: {
                        a1: {
                            "@type": "Alert",
                            acknowledged: "2026-02-01T00:00:00Z",
                            action: "display",
                            trigger: {
                                "@type": "OffsetTrigger",
                                offset: "-PT15M",
                            },
                            relatedTo: {
                                start: {
                                    "@type": "Relation",
                                    relation: { first: true },
                                },
                            },
                        },
                    },
                    localizations: {
                        en: { title: "Review EN", keywords: { sprint: true } },
                    },
                    timeZone: "Asia/Tokyo",
                    timeZones: {
                        "Asia/Tokyo": {
                            "@type": "TimeZone",
                            tzId: "Asia/Tokyo",
                            updated: "2026-02-01T00:00:00Z",
                            url: "https://example.com/tz",
                            validUntil: "2027-02-01T00:00:00Z",
                            aliases: { JST: true },
                            standard: [
                                {
                                    "@type": "TimeZoneRule",
                                    start: "2026-01-01T00:00:00",
                                    offsetFrom: "+09:00",
                                    offsetTo: "+09:00",
                                    recurrenceRules: [
                                        {
                                            "@type": "RecurrenceRule",
                                            frequency: "yearly",
                                            byMonth: ["1"],
                                        },
                                    ],
                                    comments: ["fixed offset"],
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
                },
                "object",
            ),
        ).not.toThrow();
    });

    it("rejects invalid nested object shapes", () => {
        expect(() =>
            validateCommon(
                {
                    "@type": "Event",
                    uid: "evt-1",
                    updated: "2026-02-01T00:00:00Z",
                    start: "2026-02-01T09:00:00",
                    recurrenceOverrides: [] as never,
                },
                "object",
            ),
        ).toThrowError("object.recurrenceOverrides: must be an object");

        expect(() =>
            validateCommon(
                {
                    "@type": "Event",
                    uid: "evt-1",
                    updated: "2026-02-01T00:00:00Z",
                    start: "2026-02-01T09:00:00",
                    timeZones: [] as never,
                },
                "object",
            ),
        ).toThrowError("object.timeZones: must be an object");

        expect(() =>
            validateLocation(
                {
                    "@type": "Location",
                    links: [] as never,
                },
                "location",
            ),
        ).toThrowError("location.links: must be an object");

        expect(() =>
            validateParticipant(
                {
                    "@type": "Participant",
                    roles: { attendee: true },
                    sendTo: [] as never,
                },
                "participant",
            ),
        ).toThrowError("participant.sendTo: must be an object");

        expect(() =>
            validateAlert(
                {
                    "@type": "Alert",
                    trigger: { "@type": "OffsetTrigger" } as never,
                },
                "alert",
            ),
        ).toThrowError("alert.trigger.offset: must be a duration string");
    });

    it("covers recurrence validators for valid and invalid edge cases", () => {
        expect(() =>
            validateNDay(
                { "@type": "NDay", day: "fr", nthOfPeriod: -1 },
                "rule.byDay[0]",
            ),
        ).not.toThrow();

        expect(() =>
            validateRecurrenceRule(
                {
                    "@type": "RecurrenceRule",
                    frequency: "monthly",
                    interval: 1,
                    count: 3,
                    skip: "omit",
                    firstDayOfWeek: "su",
                    byDay: [{ "@type": "NDay", day: "mo", nthOfPeriod: 1 }],
                    byMonthDay: [1, -1],
                    byMonth: ["2", "11"],
                    byYearDay: [1, -1],
                    byWeekNo: [1, -1],
                    byHour: [0, 23],
                    byMinute: [0, 59],
                    bySecond: [0, 59],
                    bySetPosition: [1, -1],
                    until: "2026-12-31T23:59:59",
                },
                "rule",
            ),
        ).not.toThrow();

        expect(() =>
            validateRecurrenceRule(
                {
                    "@type": "RecurrenceRule",
                    frequency: "daily",
                    byMonth: ["13"],
                },
                "rule",
            ),
        ).toThrowError(
            "rule.byMonth[0]: must be a month number between 1 and 12",
        );

        expect(() =>
            validateRecurrenceRule(
                {
                    "@type": "RecurrenceRule",
                    frequency: "daily",
                    byYearDay: [367],
                },
                "rule",
            ),
        ).toThrowError(
            "rule.byYearDay[0]: must be an integer between -366 and 366, excluding 0",
        );

        expect(() =>
            validateRecurrenceRule(
                {
                    "@type": "RecurrenceRule",
                    frequency: "daily",
                    byWeekNo: [54],
                },
                "rule",
            ),
        ).toThrowError(
            "rule.byWeekNo[0]: must be an integer between -53 and 53, excluding 0",
        );

        expect(() =>
            validateRecurrenceRule(
                {
                    "@type": "RecurrenceRule",
                    frequency: "daily",
                    byHour: [24],
                },
                "rule",
            ),
        ).toThrowError("rule.byHour[0]: must be an integer between 0 and 23");

        expect(() =>
            validateRecurrenceRule(
                {
                    "@type": "RecurrenceRule",
                    frequency: "daily",
                    byMinute: [60],
                },
                "rule",
            ),
        ).toThrowError("rule.byMinute[0]: must be an integer between 0 and 59");

        expect(() =>
            validateRecurrenceRule(
                {
                    "@type": "RecurrenceRule",
                    frequency: "daily",
                    bySecond: [60],
                },
                "rule",
            ),
        ).toThrowError("rule.bySecond[0]: must be an integer between 0 and 59");

        expect(() =>
            validateRecurrenceRule(
                {
                    "@type": "RecurrenceRule",
                    frequency: "daily",
                    bySetPosition: [0],
                },
                "rule",
            ),
        ).toThrowError("rule.bySetPosition[0]: must be a non-zero integer");
    });

    it("covers JSON patch assertions and patch builders", () => {
        expect(() =>
            assertJsonValue(["x", 1, false, null, { nested: ["ok"] }], "value"),
        ).not.toThrow();
        expect(() =>
            assertPatchObject(
                {
                    title: "Updated",
                    tags: ["one", "two"],
                    nested: { flag: true },
                    removed: null,
                },
                "patch",
            ),
        ).not.toThrow();
        expect(() => assertJsonValue(undefined, "value")).toThrowError(
            "value: must be a JSON value",
        );
        expect(() =>
            assertJsonValue(Symbol("bad") as never, "value"),
        ).toThrowError("value: must be a JSON value");

        expect(
            buildEventPatch({
                title: "Updated",
                description: "Patched",
                keywords: { ok: true },
            }),
        ).toMatchObject({
            title: "Updated",
        });
        expect(buildTaskPatch({ progress: "completed" })).toMatchObject({
            progress: "completed",
        });
        expect(
            buildGroupPatch({ source: "https://example.com/group" }),
        ).toMatchObject({
            source: "https://example.com/group",
        });
    });

    it("covers remaining builder wrappers", () => {
        const virtualLocations = JsCal.virtualLocations([
            { value: { uri: "https://example.com/meet" } },
        ]);
        const alerts = JsCal.alerts([
            {
                value: {
                    trigger: { "@type": "OffsetTrigger", offset: "-PT5M" },
                },
            },
        ]);

        expect(Object.keys(virtualLocations)).toHaveLength(1);
        expect(Object.keys(alerts)).toHaveLength(1);
    });
});
