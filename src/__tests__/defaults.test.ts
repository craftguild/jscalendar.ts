import { describe, expect, it } from "vitest";
import {
    applyAlertDefaults,
    applyCommonDefaults,
    applyEventDefaults,
    applyParticipantDefaults,
    applyTaskDefaults,
} from "../jscal/defaults.js";

describe("jscal defaults", () => {
    it("fills RFC defaults without overwriting existing values", () => {
        const event = applyEventDefaults(
            applyCommonDefaults({
                "@type": "Event",
                uid: "evt-1",
                updated: "2026-02-01T00:00:00Z",
                start: "2026-02-01T09:00:00",
                title: "Existing",
                priority: 7,
            }),
        );

        expect(event.sequence).toBe(0);
        expect(event.description).toBe("");
        expect(event.descriptionContentType).toBe("text/plain");
        expect(event.showWithoutTime).toBe(false);
        expect(event.recurrenceIdTimeZone).toBeNull();
        expect(event.excluded).toBe(false);
        expect(event.freeBusyStatus).toBe("busy");
        expect(event.privacy).toBe("public");
        expect(event.useDefaultAlerts).toBe(false);
        expect(event.duration).toBe("PT0S");
        expect(event.status).toBe("confirmed");
        expect(event.title).toBe("Existing");
        expect(event.priority).toBe(7);
    });

    it("derives task progress from participant progress states", () => {
        expect(
            applyTaskDefaults({
                "@type": "Task",
                uid: "task-1",
                updated: "2026-02-01T00:00:00Z",
            }).progress,
        ).toBe("needs-action");

        expect(
            applyTaskDefaults({
                "@type": "Task",
                uid: "task-2",
                updated: "2026-02-01T00:00:00Z",
                participants: {
                    p1: {
                        "@type": "Participant",
                        roles: { owner: true },
                        progress: "completed",
                    },
                    p2: {
                        "@type": "Participant",
                        roles: { owner: true },
                        progress: "completed",
                    },
                },
            }).progress,
        ).toBe("completed");

        expect(
            applyTaskDefaults({
                "@type": "Task",
                uid: "task-3",
                updated: "2026-02-01T00:00:00Z",
                participants: {
                    p1: {
                        "@type": "Participant",
                        roles: { owner: true },
                        progress: "failed",
                    },
                },
            }).progress,
        ).toBe("failed");

        expect(
            applyTaskDefaults({
                "@type": "Task",
                uid: "task-4",
                updated: "2026-02-01T00:00:00Z",
                participants: {
                    p1: {
                        "@type": "Participant",
                        roles: { owner: true },
                        progress: "in-process",
                    },
                },
            }).progress,
        ).toBe("in-process");

        expect(
            applyTaskDefaults({
                "@type": "Task",
                uid: "task-5",
                updated: "2026-02-01T00:00:00Z",
                participants: {
                    p1: {
                        "@type": "Participant",
                        roles: { owner: true },
                        progress: "needs-action",
                    },
                },
            }).progress,
        ).toBe("needs-action");
    });

    it("fills participant and alert defaults", () => {
        const participant = applyParticipantDefaults({
            "@type": "Participant",
            roles: { attendee: true },
        });
        const offsetAlert = applyAlertDefaults({
            "@type": "Alert",
            trigger: { "@type": "OffsetTrigger", offset: "-PT15M" },
        });
        const absoluteAlert = applyAlertDefaults({
            "@type": "Alert",
            action: "email",
            trigger: {
                "@type": "AbsoluteTrigger",
                when: "2026-02-01T00:00:00Z",
            },
        });

        expect(participant.participationStatus).toBe("needs-action");
        expect(participant.expectReply).toBe(false);
        expect(participant.scheduleAgent).toBe("server");
        expect(participant.scheduleForceSend).toBe(false);
        expect(participant.scheduleSequence).toBe(0);
        expect(offsetAlert.action).toBe("display");
        expect(offsetAlert.trigger["@type"]).toBe("OffsetTrigger");
        if (offsetAlert.trigger["@type"] === "OffsetTrigger") {
            expect(offsetAlert.trigger.relativeTo).toBe("start");
        }
        expect(absoluteAlert.action).toBe("email");
    });
});
