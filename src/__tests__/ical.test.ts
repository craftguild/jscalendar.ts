import { describe, expect, it } from "vitest";
import { JsCal } from "../jscal.js";
import type { Event, Task } from "../types.js";

const textEncoder = new TextEncoder();

const event: Event = {
    "@type": "Event",
    uid: "e1",
    updated: "2026-02-01T00:00:00Z",
    title: "Demo",
    description: "Details",
    sequence: 2,
    start: "2026-02-01T10:00:00",
    timeZone: "America/New_York",
    duration: "PT30M",
    status: "confirmed",
    recurrenceRules: [
        {
            "@type": "RecurrenceRule",
            frequency: "weekly",
            byDay: [{ "@type": "NDay", day: "mo" }],
        },
    ],
};

describe("toICal", () => {
    it("exports minimal VEVENT with X-JSCALENDAR", () => {
        const ical = JsCal.toICal([event], { includeXJSCalendar: true });
        expect(ical).toContain("BEGIN:VCALENDAR");
        expect(ical).toContain("BEGIN:VEVENT");
        expect(ical).toContain("UID:e1");
        expect(ical).toContain("DTSTART;TZID=America/New_York:20260201T100000");
        expect(ical).toContain("DURATION:PT30M");
        expect(ical).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO");
        expect(ical).toContain("X-JSCALENDAR:");
        expect(ical).toContain("END:VEVENT");
        expect(ical).toContain("END:VCALENDAR");
    });

    it("omits X-JSCALENDAR when disabled", () => {
        const ical = JsCal.toICal([event], { includeXJSCalendar: false });
        expect(ical).not.toContain("X-JSCALENDAR:");
    });

    it("exports full recurrence rule fields", () => {
        const rich: Event = {
            "@type": "Event",
            uid: "e2",
            updated: "2026-02-01T00:00:00Z",
            title: "Rich",
            start: "2026-02-01T10:00:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "monthly",
                    interval: 2,
                    count: 5,
                    until: "2026-12-31T00:00:00",
                    byDay: [{ "@type": "NDay", day: "mo", nthOfPeriod: 1 }],
                    byMonthDay: [1, -1],
                    byMonth: ["2", "3"],
                    byYearDay: [32],
                    byWeekNo: [1],
                    byHour: [9],
                    byMinute: [30],
                    bySecond: [15],
                    bySetPosition: [1],
                    firstDayOfWeek: "mo",
                    rscale: "gregorian",
                    skip: "forward",
                },
            ],
        };

        const ical = JsCal.toICal([rich]);
        const unfolded = ical.replace(/\r\n[ \t]/g, "");
        expect(unfolded).toContain(
            "RRULE:FREQ=MONTHLY;INTERVAL=2;COUNT=5;UNTIL=20261231T000000;BYDAY=1MO;BYMONTHDAY=1,-1;BYMONTH=2,3;BYYEARDAY=32;BYWEEKNO=1;BYHOUR=9;BYMINUTE=30;BYSECOND=15;BYSETPOS=1;WKST=MO;RSCALE=GREGORIAN;SKIP=FORWARD",
        );
    });

    it("folds UTF-8 content lines to 75 octets", () => {
        const rich: Event = {
            "@type": "Event",
            uid: "e3",
            updated: "2026-04-18T03:25:21Z",
            title: "準備每週專案更新と進捗確認資料",
            description: "整理進度、阻礙事項和下一步行動，並分享給團隊。",
            start: "2026-04-15T13:00:00",
            timeZone: "Asia/Tokyo",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "monthly",
                    interval: 1,
                    until: "2026-09-01T13:00:00",
                    byMonthDay: [15],
                    skip: "backward",
                },
            ],
        };

        const ical = JsCal.toICal([rich]);
        for (const line of ical.split("\r\n")) {
            expect(textEncoder.encode(line).length).toBeLessThanOrEqual(75);
        }

        const unfolded = ical.replace(/\r\n[ \t]/g, "");
        expect(unfolded).toContain("SUMMARY:準備每週專案更新と進捗確認資料");
        expect(unfolded).toContain("SKIP=BACKWARD");
    });

    it("exports multilingual VTODO examples with valid folded lines", () => {
        const examples: {
            task: Task;
            expectedDescriptionLine: string;
            expectedDtStartLine: string;
            expectedRRuleLine: string;
        }[] = [
            {
                task: {
                    "@type": "Task",
                    uid: "9f8e5ccb-2e2d-4cdc-9811-bcbc7cff2910",
                    updated: "2026-04-18T03:25:21.304Z",
                    title: "주간 프로젝트 업데이트 준비",
                    description:
                        "진행 상황, 막힌 부분, 다음 작업을 정리해 팀에 공유합니다.",
                    start: "2026-04-21T09:30:00",
                    timeZone: "Asia/Tokyo",
                    recurrenceRules: [
                        {
                            "@type": "RecurrenceRule",
                            frequency: "daily",
                            interval: 1,
                            until: "2026-08-19T09:30:00",
                            skip: "backward",
                        },
                    ],
                    recurrenceIdTimeZone: null,
                    excluded: false,
                },
                expectedDescriptionLine:
                    "DESCRIPTION:진행 상황\\, 막힌 부분\\, 다음 작업을 정리해 팀에 공유합니다.",
                expectedDtStartLine: "DTSTART;TZID=Asia/Tokyo:20260421T093000",
                expectedRRuleLine:
                    "RRULE:FREQ=DAILY;INTERVAL=1;UNTIL=20260819T093000;SKIP=BACKWARD",
            },
            {
                task: {
                    "@type": "Task",
                    uid: "71b26d66-3300-44dc-a08b-390053f25ec8",
                    updated: "2026-04-18T03:25:21.237Z",
                    title: "週次プロジェクト報告を作成",
                    description:
                        "進捗、課題、次の対応を整理してチームに共有します。",
                    start: "2026-03-17T13:45:00",
                    timeZone: "Asia/Tokyo",
                    recurrenceRules: [
                        {
                            "@type": "RecurrenceRule",
                            frequency: "monthly",
                            interval: 1,
                            until: "2026-09-08T13:45:00",
                            byMonthDay: [25],
                            skip: "backward",
                        },
                    ],
                    recurrenceIdTimeZone: null,
                    excluded: false,
                },
                expectedDescriptionLine:
                    "DESCRIPTION:進捗、課題、次の対応を整理してチームに共有します。",
                expectedDtStartLine: "DTSTART;TZID=Asia/Tokyo:20260317T134500",
                expectedRRuleLine:
                    "RRULE:FREQ=MONTHLY;INTERVAL=1;UNTIL=20260908T134500;BYMONTHDAY=25;SKIP=BACKWARD",
            },
            {
                task: {
                    "@type": "Task",
                    uid: "90493463-9b94-4f64-a9e4-906e1e329511",
                    updated: "2026-04-18T03:25:21.225Z",
                    title: "Review customer feedback",
                    description:
                        "Check recent feedback and convert important items into follow-up tasks.",
                    start: "2026-03-04T11:00:00",
                    timeZone: "Asia/Tokyo",
                    recurrenceRules: [
                        {
                            "@type": "RecurrenceRule",
                            frequency: "daily",
                            interval: 3,
                            until: "2026-08-06T11:00:00",
                            skip: "backward",
                        },
                    ],
                    recurrenceIdTimeZone: null,
                    excluded: false,
                },
                expectedDescriptionLine:
                    "DESCRIPTION:Check recent feedback and convert important items into follow-up tasks.",
                expectedDtStartLine: "DTSTART;TZID=Asia/Tokyo:20260304T110000",
                expectedRRuleLine:
                    "RRULE:FREQ=DAILY;INTERVAL=3;UNTIL=20260806T110000;SKIP=BACKWARD",
            },
        ];

        for (const {
            task,
            expectedDescriptionLine,
            expectedDtStartLine,
            expectedRRuleLine,
        } of examples) {
            const ical = JsCal.toICal([task]);
            for (const line of ical.split("\r\n")) {
                expect(textEncoder.encode(line).length).toBeLessThanOrEqual(75);
            }

            const unfolded = ical.replace(/\r\n[ \t]/g, "");
            expect(unfolded).toContain("BEGIN:VTODO");
            expect(unfolded).toContain(`UID:${task.uid}`);
            expect(unfolded).toContain(`SUMMARY:${task.title}`);
            expect(unfolded).toContain(expectedDescriptionLine);
            expect(unfolded).toContain(expectedDtStartLine);
            expect(unfolded).toContain(expectedRRuleLine);
            expect(unfolded).toContain(`"uid":"${task.uid}"`);
            expect(unfolded).toContain("END:VTODO");
        }
    });
});
