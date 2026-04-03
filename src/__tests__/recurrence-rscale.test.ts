import { describe, expect, it } from "vitest";
import { JsCal } from "../jscal.js";
import {
    CanonicalRscales,
    SupportedRscaleInputs,
    resolveRscaleDefinition,
} from "../recurrence/calendar/rscale-registry.js";
import { Temporal } from "../recurrence/calendar/temporal.js";
import type {
    PlainDate,
    PlainDateTime,
    ZonedDateTime,
} from "../recurrence/calendar/temporal.js";
import type {
    Event,
    JSCalendarObject,
    RecurrenceRule,
    TimeZoneId,
} from "../types.js";

const CanonicalRscaleCases = [
    { rscale: "gregorian", start: "2026-06-15" },
    { rscale: "hebrew", start: "2026-06-15" },
    { rscale: "chinese", start: "2026-06-15" },
    { rscale: "dangi", start: "2026-06-15" },
    { rscale: "indian", start: "2026-06-15" },
    { rscale: "persian", start: "2026-06-15" },
    { rscale: "japanese", start: "2026-06-15" },
    { rscale: "buddhist", start: "2026-06-15" },
    { rscale: "roc", start: "2026-06-15" },
    { rscale: "coptic", start: "2026-06-15" },
    { rscale: "ethiopic", start: "2026-06-15" },
    { rscale: "ethiopic-amete-alem", start: "2026-06-15" },
    { rscale: "islamic", start: "2026-06-15" },
    { rscale: "islamic-civil", start: "2026-06-15" },
    { rscale: "islamic-tbla", start: "2026-06-15" },
    { rscale: "islamic-umalqura", start: "2026-06-15" },
] as const;

type GregorianMonthStartExpectation = {
    gregorian: string;
    calendar: {
        year: number;
        monthCode: string;
        day: number;
    };
};

type OccurrenceExpectation = {
    gregorian: string;
};

const RuntimeCalendarAvailabilityCache = new Map<string, boolean>();
const CalendarDateTimeCache = new Map<string, PlainDateTime | ZonedDateTime>();
const LeapMonthIsoDateCache = new Map<
    string,
    { date: string; byMonth: string; day: number } | null
>();
const MonthTokenOccurrencesCache = new Map<
    string,
    Array<{ date: string; byMonth: string; day: number }>
>();
const MonthDayTokenDateCache = new Map<string, string | null>();
const CalendarYearEndDatesCache = new Map<string, string[]>();
const GregorianMonthStartRowsCache = new Map<
    string,
    GregorianMonthStartExpectation[]
>();
const MonthDayOccurrencesCache = new Map<string, string[]>();
const CalendarWeekNumberCache = new Map<string, number>();
const WeekStartForYearCache = new Map<string, PlainDate>();

const GregorianMonthStartCases = [
    {
        rscale: "gregorian",
        expected: [
            row("2026-06-01", 2026, "M06", 1),
            row("2026-07-01", 2026, "M07", 1),
            row("2026-08-01", 2026, "M08", 1),
            row("2026-09-01", 2026, "M09", 1),
            row("2026-10-01", 2026, "M10", 1),
            row("2026-11-01", 2026, "M11", 1),
            row("2026-12-01", 2026, "M12", 1),
            row("2027-01-01", 2027, "M01", 1),
            row("2027-02-01", 2027, "M02", 1),
            row("2027-03-01", 2027, "M03", 1),
            row("2027-04-01", 2027, "M04", 1),
            row("2027-05-01", 2027, "M05", 1),
            row("2027-06-01", 2027, "M06", 1),
        ],
    },
    {
        rscale: "hebrew",
        expected: [
            row("2026-06-01", 5786, "M09", 16),
            row("2026-07-01", 5786, "M10", 16),
            row("2026-08-01", 5786, "M11", 18),
            row("2026-09-01", 5786, "M12", 19),
            row("2026-10-01", 5787, "M01", 20),
            row("2026-11-01", 5787, "M02", 21),
            row("2026-12-01", 5787, "M03", 21),
            row("2027-01-01", 5787, "M04", 22),
            row("2027-02-01", 5787, "M05", 24),
            row("2027-03-01", 5787, "M05L", 22),
            row("2027-04-01", 5787, "M06", 23),
            row("2027-05-01", 5787, "M07", 24),
            row("2027-06-01", 5787, "M08", 25),
        ],
    },
    {
        rscale: "chinese",
        expected: [
            row("2026-06-01", 2026, "M04", 16),
            row("2026-07-01", 2026, "M05", 17),
            row("2026-08-01", 2026, "M06", 19),
            row("2026-09-01", 2026, "M07", 20),
            row("2026-10-01", 2026, "M08", 21),
            row("2026-11-01", 2026, "M09", 23),
            row("2026-12-01", 2026, "M10", 23),
            row("2027-01-01", 2026, "M11", 24),
            row("2027-02-01", 2026, "M12", 25),
            row("2027-03-01", 2027, "M01", 23),
            row("2027-04-01", 2027, "M02", 25),
            row("2027-05-01", 2027, "M03", 25),
            row("2027-06-01", 2027, "M04", 27),
        ],
    },
    {
        rscale: "dangi",
        expected: [
            row("2026-06-01", 2026, "M04", 16),
            row("2026-07-01", 2026, "M05", 17),
            row("2026-08-01", 2026, "M06", 19),
            row("2026-09-01", 2026, "M07", 20),
            row("2026-10-01", 2026, "M08", 21),
            row("2026-11-01", 2026, "M09", 22),
            row("2026-12-01", 2026, "M10", 23),
            row("2027-01-01", 2026, "M11", 24),
            row("2027-02-01", 2026, "M12", 25),
            row("2027-03-01", 2027, "M01", 23),
            row("2027-04-01", 2027, "M02", 25),
            row("2027-05-01", 2027, "M03", 25),
            row("2027-06-01", 2027, "M04", 27),
        ],
    },
    {
        rscale: "indian",
        expected: [
            row("2026-06-01", 1948, "M03", 11),
            row("2026-07-01", 1948, "M04", 10),
            row("2026-08-01", 1948, "M05", 10),
            row("2026-09-01", 1948, "M06", 10),
            row("2026-10-01", 1948, "M07", 9),
            row("2026-11-01", 1948, "M08", 10),
            row("2026-12-01", 1948, "M09", 10),
            row("2027-01-01", 1948, "M10", 11),
            row("2027-02-01", 1948, "M11", 12),
            row("2027-03-01", 1948, "M12", 10),
            row("2027-04-01", 1949, "M01", 11),
            row("2027-05-01", 1949, "M02", 11),
            row("2027-06-01", 1949, "M03", 11),
        ],
    },
    {
        rscale: "persian",
        expected: [
            row("2026-06-01", 1405, "M03", 11),
            row("2026-07-01", 1405, "M04", 10),
            row("2026-08-01", 1405, "M05", 10),
            row("2026-09-01", 1405, "M06", 10),
            row("2026-10-01", 1405, "M07", 9),
            row("2026-11-01", 1405, "M08", 10),
            row("2026-12-01", 1405, "M09", 10),
            row("2027-01-01", 1405, "M10", 11),
            row("2027-02-01", 1405, "M11", 12),
            row("2027-03-01", 1405, "M12", 10),
            row("2027-04-01", 1406, "M01", 12),
            row("2027-05-01", 1406, "M02", 11),
            row("2027-06-01", 1406, "M03", 11),
        ],
    },
    {
        rscale: "japanese",
        expected: [
            row("2026-06-01", 2026, "M06", 1),
            row("2026-07-01", 2026, "M07", 1),
            row("2026-08-01", 2026, "M08", 1),
            row("2026-09-01", 2026, "M09", 1),
            row("2026-10-01", 2026, "M10", 1),
            row("2026-11-01", 2026, "M11", 1),
            row("2026-12-01", 2026, "M12", 1),
            row("2027-01-01", 2027, "M01", 1),
            row("2027-02-01", 2027, "M02", 1),
            row("2027-03-01", 2027, "M03", 1),
            row("2027-04-01", 2027, "M04", 1),
            row("2027-05-01", 2027, "M05", 1),
            row("2027-06-01", 2027, "M06", 1),
        ],
    },
    {
        rscale: "buddhist",
        expected: [
            row("2026-06-01", 2569, "M06", 1),
            row("2026-07-01", 2569, "M07", 1),
            row("2026-08-01", 2569, "M08", 1),
            row("2026-09-01", 2569, "M09", 1),
            row("2026-10-01", 2569, "M10", 1),
            row("2026-11-01", 2569, "M11", 1),
            row("2026-12-01", 2569, "M12", 1),
            row("2027-01-01", 2570, "M01", 1),
            row("2027-02-01", 2570, "M02", 1),
            row("2027-03-01", 2570, "M03", 1),
            row("2027-04-01", 2570, "M04", 1),
            row("2027-05-01", 2570, "M05", 1),
            row("2027-06-01", 2570, "M06", 1),
        ],
    },
    {
        rscale: "roc",
        expected: [
            row("2026-06-01", 115, "M06", 1),
            row("2026-07-01", 115, "M07", 1),
            row("2026-08-01", 115, "M08", 1),
            row("2026-09-01", 115, "M09", 1),
            row("2026-10-01", 115, "M10", 1),
            row("2026-11-01", 115, "M11", 1),
            row("2026-12-01", 115, "M12", 1),
            row("2027-01-01", 116, "M01", 1),
            row("2027-02-01", 116, "M02", 1),
            row("2027-03-01", 116, "M03", 1),
            row("2027-04-01", 116, "M04", 1),
            row("2027-05-01", 116, "M05", 1),
            row("2027-06-01", 116, "M06", 1),
        ],
    },
    {
        rscale: "coptic",
        expected: [
            row("2026-06-01", 1742, "M09", 24),
            row("2026-07-01", 1742, "M10", 24),
            row("2026-08-01", 1742, "M11", 25),
            row("2026-09-01", 1742, "M12", 26),
            row("2026-10-01", 1743, "M01", 21),
            row("2026-11-01", 1743, "M02", 22),
            row("2026-12-01", 1743, "M03", 22),
            row("2027-01-01", 1743, "M04", 23),
            row("2027-02-01", 1743, "M05", 24),
            row("2027-03-01", 1743, "M06", 22),
            row("2027-04-01", 1743, "M07", 23),
            row("2027-05-01", 1743, "M08", 23),
            row("2027-06-01", 1743, "M09", 24),
        ],
    },
    {
        rscale: "ethiopic",
        expected: [
            row("2026-06-01", 7518, "M09", 24),
            row("2026-07-01", 7518, "M10", 24),
            row("2026-08-01", 7518, "M11", 25),
            row("2026-09-01", 7518, "M12", 26),
            row("2026-10-01", 7519, "M01", 21),
            row("2026-11-01", 7519, "M02", 22),
            row("2026-12-01", 7519, "M03", 22),
            row("2027-01-01", 7519, "M04", 23),
            row("2027-02-01", 7519, "M05", 24),
            row("2027-03-01", 7519, "M06", 22),
            row("2027-04-01", 7519, "M07", 23),
            row("2027-05-01", 7519, "M08", 23),
            row("2027-06-01", 7519, "M09", 24),
        ],
    },
    {
        rscale: "ethiopic-amete-alem",
        expected: [
            row("2026-06-01", 7518, "M09", 24),
            row("2026-07-01", 7518, "M10", 24),
            row("2026-08-01", 7518, "M11", 25),
            row("2026-09-01", 7518, "M12", 26),
            row("2026-10-01", 7519, "M01", 21),
            row("2026-11-01", 7519, "M02", 22),
            row("2026-12-01", 7519, "M03", 22),
            row("2027-01-01", 7519, "M04", 23),
            row("2027-02-01", 7519, "M05", 24),
            row("2027-03-01", 7519, "M06", 22),
            row("2027-04-01", 7519, "M07", 23),
            row("2027-05-01", 7519, "M08", 23),
            row("2027-06-01", 7519, "M09", 24),
        ],
    },
    {
        rscale: "islamic",
        expected: [
            row("2026-06-01", 1447, "M12", 16),
            row("2026-07-01", 1448, "M01", 16),
            row("2026-08-01", 1448, "M02", 18),
            row("2026-09-01", 1448, "M03", 20),
            row("2026-10-01", 1448, "M04", 20),
            row("2026-11-01", 1448, "M05", 22),
            row("2026-12-01", 1448, "M06", 22),
            row("2027-01-01", 1448, "M07", 23),
            row("2027-02-01", 1448, "M08", 25),
            row("2027-03-01", 1448, "M09", 23),
            row("2027-04-01", 1448, "M10", 24),
            row("2027-05-01", 1448, "M11", 24),
            row("2027-06-01", 1448, "M12", 26),
        ],
    },
    {
        rscale: "islamic-civil",
        expected: [
            row("2026-06-01", 1447, "M12", 15),
            row("2026-07-01", 1448, "M01", 15),
            row("2026-08-01", 1448, "M02", 16),
            row("2026-09-01", 1448, "M03", 18),
            row("2026-10-01", 1448, "M04", 18),
            row("2026-11-01", 1448, "M05", 20),
            row("2026-12-01", 1448, "M06", 20),
            row("2027-01-01", 1448, "M07", 22),
            row("2027-02-01", 1448, "M08", 23),
            row("2027-03-01", 1448, "M09", 22),
            row("2027-04-01", 1448, "M10", 23),
            row("2027-05-01", 1448, "M11", 24),
            row("2027-06-01", 1448, "M12", 25),
        ],
    },
    {
        rscale: "islamic-tbla",
        expected: [
            row("2026-06-01", 1447, "M12", 16),
            row("2026-07-01", 1448, "M01", 16),
            row("2026-08-01", 1448, "M02", 17),
            row("2026-09-01", 1448, "M03", 19),
            row("2026-10-01", 1448, "M04", 19),
            row("2026-11-01", 1448, "M05", 21),
            row("2026-12-01", 1448, "M06", 21),
            row("2027-01-01", 1448, "M07", 23),
            row("2027-02-01", 1448, "M08", 24),
            row("2027-03-01", 1448, "M09", 23),
            row("2027-04-01", 1448, "M10", 24),
            row("2027-05-01", 1448, "M11", 25),
            row("2027-06-01", 1448, "M12", 26),
        ],
    },
    {
        rscale: "islamic-umalqura",
        expected: [
            row("2026-06-01", 1447, "M12", 15),
            row("2026-07-01", 1448, "M01", 16),
            row("2026-08-01", 1448, "M02", 18),
            row("2026-09-01", 1448, "M03", 19),
            row("2026-10-01", 1448, "M04", 20),
            row("2026-11-01", 1448, "M05", 21),
            row("2026-12-01", 1448, "M06", 21),
            row("2027-01-01", 1448, "M07", 23),
            row("2027-02-01", 1448, "M08", 24),
            row("2027-03-01", 1448, "M09", 22),
            row("2027-04-01", 1448, "M10", 24),
            row("2027-05-01", 1448, "M11", 24),
            row("2027-06-01", 1448, "M12", 26),
        ],
    },
] as const;

const RscaleAliasCases = [
    { input: "gregory", canonical: "gregorian" },
    { input: "iso8601", canonical: "gregorian" },
    { input: "ethioaa", canonical: "ethiopic-amete-alem" },
] as const;

const ByMonthDayOneCases = [
    { rscale: "gregorian", expected: ["2027-06-01"].map(dateRow) },
    { rscale: "hebrew", expected: ["2027-06-06"].map(dateRow) },
    { rscale: "chinese", expected: ["2027-06-05"].map(dateRow) },
    { rscale: "dangi", expected: ["2027-06-05"].map(dateRow) },
    { rscale: "indian", expected: ["2027-05-22"].map(dateRow) },
    { rscale: "persian", expected: ["2027-05-22"].map(dateRow) },
    { rscale: "japanese", expected: ["2027-06-01"].map(dateRow) },
    { rscale: "buddhist", expected: ["2027-06-01"].map(dateRow) },
    { rscale: "roc", expected: ["2027-06-01"].map(dateRow) },
    { rscale: "coptic", expected: ["2027-06-08"].map(dateRow) },
    { rscale: "ethiopic", expected: ["2027-06-08"].map(dateRow) },
    { rscale: "ethiopic-amete-alem", expected: ["2027-06-08"].map(dateRow) },
    { rscale: "islamic", expected: ["2027-05-07"].map(dateRow) },
    { rscale: "islamic-civil", expected: ["2027-05-08"].map(dateRow) },
    { rscale: "islamic-tbla", expected: ["2027-05-07"].map(dateRow) },
    { rscale: "islamic-umalqura", expected: ["2027-05-07"].map(dateRow) },
] as const;

const ByMonthOneCases = [
    { rscale: "gregorian", expected: ["2027-01-15"].map(dateRow) },
    { rscale: "hebrew", expected: ["2026-10-11"].map(dateRow) },
    { rscale: "chinese", expected: ["2027-02-07"].map(dateRow) },
    { rscale: "dangi", expected: ["2027-02-07"].map(dateRow) },
    { rscale: "indian", expected: ["2027-04-15"].map(dateRow) },
    { rscale: "persian", expected: ["2027-04-14"].map(dateRow) },
    { rscale: "japanese", expected: ["2027-01-15"].map(dateRow) },
    { rscale: "buddhist", expected: ["2027-01-15"].map(dateRow) },
    { rscale: "roc", expected: ["2027-01-15"].map(dateRow) },
    { rscale: "coptic", expected: ["2026-09-18"].map(dateRow) },
    { rscale: "ethiopic", expected: ["2026-09-18"].map(dateRow) },
    { rscale: "ethiopic-amete-alem", expected: ["2026-09-18"].map(dateRow) },
    { rscale: "islamic", expected: [].map(dateRow) },
    { rscale: "islamic-civil", expected: ["2026-07-15"].map(dateRow) },
    { rscale: "islamic-tbla", expected: ["2026-07-15"].map(dateRow) },
    { rscale: "islamic-umalqura", expected: ["2026-07-14"].map(dateRow) },
] as const;

const ByYearDayLastCases = [
    { rscale: "gregorian", expected: ["2026-12-31"].map(dateRow) },
    { rscale: "hebrew", expected: ["2026-09-11"].map(dateRow) },
    { rscale: "chinese", expected: ["2027-02-06"].map(dateRow) },
    { rscale: "dangi", expected: ["2027-02-06"].map(dateRow) },
    { rscale: "indian", expected: ["2027-03-21"].map(dateRow) },
    { rscale: "persian", expected: ["2027-03-20"].map(dateRow) },
    { rscale: "japanese", expected: ["2026-12-31"].map(dateRow) },
    { rscale: "buddhist", expected: ["2026-12-31"].map(dateRow) },
    { rscale: "roc", expected: ["2026-12-31"].map(dateRow) },
    { rscale: "coptic", expected: ["2026-09-10"].map(dateRow) },
    { rscale: "ethiopic", expected: ["2026-09-10"].map(dateRow) },
    { rscale: "ethiopic-amete-alem", expected: ["2026-09-10"].map(dateRow) },
    { rscale: "islamic", expected: ["2027-06-04"].map(dateRow) },
    {
        rscale: "islamic-civil",
        expected: ["2026-06-16", "2027-06-05"].map(dateRow),
    },
    { rscale: "islamic-tbla", expected: ["2027-06-04"].map(dateRow) },
    { rscale: "islamic-umalqura", expected: ["2027-06-05"].map(dateRow) },
] as const;

const ByWeekNoOneMondayCases = [
    { rscale: "gregorian", expected: ["2027-01-04"].map(dateRow) },
    { rscale: "hebrew", expected: ["2026-09-14"].map(dateRow) },
    { rscale: "chinese", expected: ["2027-02-08"].map(dateRow) },
    { rscale: "dangi", expected: ["2027-02-08"].map(dateRow) },
    { rscale: "indian", expected: ["2027-03-22"].map(dateRow) },
    { rscale: "persian", expected: ["2027-03-22"].map(dateRow) },
    { rscale: "japanese", expected: ["2027-01-04"].map(dateRow) },
    { rscale: "buddhist", expected: ["2027-01-04"].map(dateRow) },
    { rscale: "roc", expected: ["2027-01-04"].map(dateRow) },
    { rscale: "coptic", expected: ["2026-09-14"].map(dateRow) },
    { rscale: "ethiopic", expected: ["2026-09-14"].map(dateRow) },
    { rscale: "ethiopic-amete-alem", expected: ["2026-09-14"].map(dateRow) },
    { rscale: "islamic", expected: ["2027-06-07"].map(dateRow) },
    { rscale: "islamic-civil", expected: ["2027-06-07"].map(dateRow) },
    { rscale: "islamic-tbla", expected: ["2027-06-07"].map(dateRow) },
    { rscale: "islamic-umalqura", expected: ["2027-06-07"].map(dateRow) },
] as const;

const ByDayLastSundayOfYearCases = [
    { rscale: "gregorian", expected: ["2026-12-27"].map(dateRow) },
    { rscale: "hebrew", expected: ["2026-09-06"].map(dateRow) },
    { rscale: "chinese", expected: ["2027-01-31"].map(dateRow) },
    { rscale: "dangi", expected: ["2027-01-31"].map(dateRow) },
    { rscale: "indian", expected: ["2027-03-21"].map(dateRow) },
    { rscale: "persian", expected: ["2027-03-14"].map(dateRow) },
    { rscale: "japanese", expected: ["2026-12-27"].map(dateRow) },
    { rscale: "buddhist", expected: ["2026-12-27"].map(dateRow) },
    { rscale: "roc", expected: ["2026-12-27"].map(dateRow) },
    { rscale: "coptic", expected: ["2026-09-06"].map(dateRow) },
    { rscale: "ethiopic", expected: ["2026-09-06"].map(dateRow) },
    { rscale: "ethiopic-amete-alem", expected: ["2026-09-06"].map(dateRow) },
    { rscale: "islamic", expected: ["2027-05-30"].map(dateRow) },
    { rscale: "islamic-civil", expected: ["2027-05-30"].map(dateRow) },
    { rscale: "islamic-tbla", expected: ["2027-05-30"].map(dateRow) },
    { rscale: "islamic-umalqura", expected: ["2027-05-30"].map(dateRow) },
] as const;

const TimeSelectorCases: Array<{
    label: string;
    expected: OccurrenceExpectation[];
    rule: Pick<RecurrenceRule, "byHour" | "byMinute" | "bySecond">;
}> = [
    {
        label: "BYHOUR=5",
        expected: [
            "2026-06-15T09:10:20",
            "2026-06-16T05:10:20",
            "2026-06-17T05:10:20",
        ].map(dateRow),
        rule: { byHour: [5] },
    },
    {
        label: "BYMINUTE=45",
        expected: [
            "2026-06-15T09:10:20",
            "2026-06-15T09:45:20",
            "2026-06-16T09:45:20",
        ].map(dateRow),
        rule: { byMinute: [45] },
    },
    {
        label: "BYSECOND=50",
        expected: [
            "2026-06-15T09:10:20",
            "2026-06-15T09:10:50",
            "2026-06-16T09:10:50",
        ].map(dateRow),
        rule: { bySecond: [50] },
    },
] as const;

const TimeZoneSelectorCases: Array<{
    label: string;
    rule: RecurrenceRule;
}> = [
    {
        label: "BYMONTHDAY",
        rule: {
            "@type": "RecurrenceRule" as const,
            frequency: "yearly" as const,
            byMonthDay: [1],
        },
    },
    {
        label: "BYYEARDAY",
        rule: {
            "@type": "RecurrenceRule" as const,
            frequency: "yearly" as const,
            byYearDay: [-1],
        },
    },
    {
        label: "BYDAY nth",
        rule: {
            "@type": "RecurrenceRule" as const,
            frequency: "yearly" as const,
            byDay: [
                {
                    "@type": "NDay" as const,
                    day: "su" as const,
                    nthOfPeriod: -1,
                },
            ],
        },
    },
    {
        label: "BYWEEKNO",
        rule: {
            "@type": "RecurrenceRule" as const,
            frequency: "yearly" as const,
            byWeekNo: [1],
            byDay: [{ "@type": "NDay" as const, day: "mo" as const }],
        },
    },
] as const;

const TimeZoneCrossCalendarCases: Array<{
    rscale: string;
    timeZone: TimeZoneId;
}> = [
    { rscale: "gregorian", timeZone: "Asia/Tokyo" },
    { rscale: "hebrew", timeZone: "Asia/Tokyo" },
    { rscale: "chinese", timeZone: "Asia/Tokyo" },
    { rscale: "indian", timeZone: "Asia/Tokyo" },
    { rscale: "persian", timeZone: "Asia/Tokyo" },
    { rscale: "japanese", timeZone: "Asia/Tokyo" },
    { rscale: "coptic", timeZone: "Asia/Tokyo" },
    { rscale: "islamic-civil", timeZone: "Asia/Tokyo" },
] as const;

function collect(gen: Generator<JSCalendarObject>): Event[] {
    const result: Event[] = [];
    for (const item of gen) {
        if (item["@type"] === "Event") result.push(item);
    }
    return result;
}

function row(
    gregorian: string,
    year: number,
    monthCode: string,
    day: number,
): GregorianMonthStartExpectation {
    return {
        gregorian,
        calendar: {
            year,
            monthCode,
            day,
        },
    };
}

function dateRow(gregorian: string): OccurrenceExpectation {
    return { gregorian };
}

describe("recurrence expansion rscale", () => {
    it("keeps canonical rscale behavior tests in sync with supported calendars", () => {
        expect(
            CanonicalRscaleCases.map((entry) => entry.rscale).sort(),
        ).toEqual([...CanonicalRscales].sort());
    });

    it("keeps registry input aliases under test", () => {
        const coveredInputs = new Set<string>([
            ...CanonicalRscaleCases.map((entry) => entry.rscale),
            ...RscaleAliasCases.map((entry) => entry.input),
        ]);

        expect([...coveredInputs].sort()).toEqual(
            [...SupportedRscaleInputs].sort(),
        );
    });

    it.each(RscaleAliasCases)(
        "resolves alias $input to canonical $canonical",
        ({ input, canonical }) => {
            expect(resolveRscaleDefinition(input).canonical).toBe(canonical);
        },
    );

    it.each(CanonicalRscaleCases)(
        "expands daily recurrences for $rscale with exact target dates when supported",
        ({ rscale, start }) => {
            const event = new JsCal.Event(
                {
                    title: `${rscale} Daily`,
                    start: `${start}T09:00:00`,
                    recurrenceRules: [
                        {
                            "@type": "RecurrenceRule",
                            frequency: "daily",
                            rscale,
                            count: 3,
                        },
                    ],
                },
                rscale === "gregorian" ? undefined : { validate: false },
            );

            if (rscale !== "gregorian" && !isCalendarRuntimeAvailable(rscale)) {
                expect(() =>
                    expandEventIds(event, start, addIsoDays(start, 4)),
                ).toThrow("Unsupported rscale");
                return;
            }

            expect(expandEventIds(event, start, addIsoDays(start, 4))).toEqual(
                buildDailyExpectedIds(start, 3),
            );
        },
    );

    it.each(GregorianMonthStartCases)(
        "keeps gregorian month starts fixed for $rscale from June 2026 through June 2027",
        ({ rscale, expected }) => {
            if (rscale !== "gregorian" && !isCalendarRuntimeAvailable(rscale)) {
                expect(() => gregorianMonthStartRows(rscale)).toThrow();
                return;
            }

            expect(gregorianMonthStartRows(rscale)).toEqual(expected);
        },
    );

    it.each(ByMonthDayOneCases)(
        "expands yearly BYMONTHDAY=1 for $rscale to fixed gregorian dates",
        ({ rscale, expected }) => {
            expectSelectorOccurrences(
                rscale,
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    rscale,
                    byMonthDay: [1],
                },
                expected,
            );
        },
    );

    it.each(ByMonthOneCases)(
        "expands yearly BYMONTH=1 for $rscale to fixed gregorian dates",
        ({ rscale, expected }) => {
            expectSelectorOccurrences(
                rscale,
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    rscale,
                    byMonth: ["1"],
                },
                expected,
            );
        },
    );

    it.each(ByYearDayLastCases)(
        "expands yearly BYYEARDAY=-1 for $rscale to fixed gregorian dates",
        ({ rscale, expected }) => {
            expectSelectorOccurrences(
                rscale,
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    rscale,
                    byYearDay: [-1],
                },
                expected,
            );
        },
    );

    it.each(ByWeekNoOneMondayCases)(
        "expands yearly BYWEEKNO=1 BYDAY=MO for $rscale to fixed gregorian dates",
        ({ rscale, expected }) => {
            expectSelectorOccurrences(
                rscale,
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    rscale,
                    byWeekNo: [1],
                    byDay: [{ "@type": "NDay", day: "mo" }],
                },
                expected,
            );
        },
    );

    it.each(ByDayLastSundayOfYearCases)(
        "expands yearly BYDAY=-1SU for $rscale to fixed gregorian dates",
        ({ rscale, expected }) => {
            expectSelectorOccurrences(
                rscale,
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    rscale,
                    byDay: [{ "@type": "NDay", day: "su", nthOfPeriod: -1 }],
                },
                expected,
            );
        },
    );

    it.each(CanonicalRscaleCases)(
        "applies time selectors for $rscale without changing the gregorian day sequence",
        ({ rscale }) => {
            for (const selector of TimeSelectorCases) {
                expectTimeSelectorOccurrences(
                    rscale,
                    selector.rule,
                    selector.expected,
                );
            }
        },
    );

    it.each(CanonicalRscaleCases)(
        "applies BYSETPOS after candidate generation for $rscale",
        ({ rscale }) => {
            expectSetPositionOccurrences(rscale, {
                "@type": "RecurrenceRule",
                frequency: "monthly",
                rscale,
                byDay: [
                    { "@type": "NDay", day: "mo" },
                    { "@type": "NDay", day: "tu" },
                    { "@type": "NDay", day: "we" },
                    { "@type": "NDay", day: "th" },
                    { "@type": "NDay", day: "fr" },
                ],
                bySetPosition: [1, -1],
                count: 8,
            });
        },
    );

    it.each(CanonicalRscaleCases)(
        "combines BYMONTH, BYMONTHDAY, and time selectors for $rscale",
        ({ rscale }) => {
            expectCompositeMonthDayOccurrences(rscale, "1", 1, "06:45:30", 2);
        },
    );

    it.each([
        { rscale: "gregorian", wkst: "mo" as const },
        { rscale: "gregorian", wkst: "su" as const },
        { rscale: "hebrew", wkst: "mo" as const },
        { rscale: "hebrew", wkst: "su" as const },
        { rscale: "persian", wkst: "mo" as const },
        { rscale: "persian", wkst: "su" as const },
        { rscale: "islamic-civil", wkst: "mo" as const },
        { rscale: "islamic-civil", wkst: "su" as const },
    ])(
        "keeps BYWEEKNO results in week 1 for $rscale with WKST=$wkst",
        ({ rscale, wkst }) => {
            expectWeekNumberOccurrences(rscale, wkst, {
                "@type": "RecurrenceRule",
                frequency: "yearly",
                rscale,
                byWeekNo: [1],
                byDay: [{ "@type": "NDay", day: "mo" }],
                firstDayOfWeek: wkst,
                count: 2,
            });
        },
    );

    it.each(TimeZoneCrossCalendarCases)(
        "keeps recurrenceIds stable with and without timeZone for $rscale",
        ({ rscale, timeZone }) => {
            for (const selector of TimeZoneSelectorCases) {
                expectSameIdsWithAndWithoutTimeZone(
                    rscale,
                    timeZone,
                    selector.rule,
                );
            }
        },
    );

    it("supports non-gregorian rscale expansion", () => {
        const event = new JsCal.Event({
            title: "Hebrew Daily",
            start: "2026-02-18T09:00:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "daily",
                    rscale: "hebrew",
                    count: 3,
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date("2026-02-18"),
                to: new Date("2026-02-21"),
            }),
        );

        expect(occ.map((o) => o.recurrenceId)).toEqual([
            "2026-02-18T09:00:00",
            "2026-02-19T09:00:00",
            "2026-02-20T09:00:00",
        ]);
    });

    it("supports leap-month byMonth tokens when the target year has that month", () => {
        const start = findLeapMonthIsoDate("hebrew");
        if (!start) {
            expect(() => {
                const event = new JsCal.Event(
                    {
                        title: "Leap Month Unsupported",
                        start: "2026-02-01T09:00:00",
                        recurrenceRules: [
                            {
                                "@type": "RecurrenceRule",
                                frequency: "yearly",
                                rscale: "hebrew",
                                byMonth: ["6L"],
                                byMonthDay: [1],
                                count: 1,
                            },
                        ],
                    },
                    { validate: false },
                );
                collect(
                    JsCal.expandRecurrence([event], {
                        from: new Date("2026-01-01"),
                        to: new Date("2026-12-31"),
                    }),
                );
            }).toThrow("Unsupported rscale");
            return;
        }

        const event = new JsCal.Event({
            title: "Hebrew Leap Month",
            start: `${start.date}T09:00:00`,
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    rscale: "hebrew",
                    byMonth: [start.byMonth],
                    byMonthDay: [start.day],
                    count: 1,
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date(`${start.date}T00:00:00Z`),
                to: new Date(`${start.date}T23:59:59Z`),
            }),
        );

        expect(occ.map((o) => o.recurrenceId)).toEqual([
            `${start.date}T09:00:00`,
        ]);
    });

    it("omits non-leap years for leap-month byMonth tokens instead of throwing", () => {
        const occurrences = findMonthTokenOccurrences("hebrew", 3);
        if (occurrences.length < 3) {
            expect(() => {
                void 0;
            }).not.toThrow();
            return;
        }

        const first = occurrences[0];
        const last = occurrences[2];
        if (!first || !last) {
            return;
        }
        const event = new JsCal.Event({
            title: "Hebrew Leap Month Series",
            start: `${first.date}T09:00:00`,
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    rscale: "hebrew",
                    byMonth: [first.byMonth],
                    byMonthDay: [first.day],
                    count: 3,
                },
            ],
        });

        const occ = collect(
            JsCal.expandRecurrence([event], {
                from: new Date(`${first.date}T00:00:00Z`),
                to: new Date(`${last.date}T23:59:59Z`),
            }),
        );

        expect(occ.map((o) => o.recurrenceId)).toEqual(
            occurrences.map((entry) => `${entry.date}T09:00:00`),
        );
    });

    it("keeps leap-month tokens distinct from their non-leap sibling month", () => {
        const leapMonth = findLeapMonthIsoDate("hebrew");
        if (!leapMonth) {
            expect(() => {
                void 0;
            }).not.toThrow();
            return;
        }

        const siblingMonth = leapMonth.byMonth.replace("L", "");
        const leapEvent = new JsCal.Event({
            title: "Leap Month Only",
            start: `${leapMonth.date}T09:00:00`,
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    rscale: "hebrew",
                    byMonth: [leapMonth.byMonth],
                    byMonthDay: [leapMonth.day],
                    count: 1,
                },
            ],
        });
        const siblingDate = findMonthDayTokenDate(
            "hebrew",
            siblingMonth,
            leapMonth.day,
        );
        if (!siblingDate) {
            expect(() => {
                void 0;
            }).not.toThrow();
            return;
        }

        const siblingEvent = new JsCal.Event({
            title: "Sibling Month Only",
            start: `${siblingDate}T09:00:00`,
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    rscale: "hebrew",
                    byMonth: [siblingMonth],
                    byMonthDay: [leapMonth.day],
                    count: 1,
                },
            ],
        });

        const leapId = expandEventIds(
            leapEvent,
            leapMonth.date,
            addIsoDays(leapMonth.date, 1),
        )[0];
        const siblingId = expandEventIds(
            siblingEvent,
            siblingDate,
            addIsoDays(siblingDate, 1),
        )[0];

        if (!leapId || !siblingId) {
            return;
        }

        expect(
            toCalendarDateTime(leapId, "hebrew").monthCode.endsWith("L"),
        ).toBe(true);
        expect(
            toCalendarDateTime(siblingId, "hebrew").monthCode.endsWith("L"),
        ).toBe(false);
    });

    it.each([
        {
            rscale: "japanese",
            timeZone: "Asia/Tokyo" as const,
        },
        {
            rscale: "buddhist",
            timeZone: "Asia/Bangkok" as const,
        },
        {
            rscale: "roc",
            timeZone: "Asia/Taipei" as const,
        },
    ])(
        "matches gregorian yearly occurrences for era-offset calendar $rscale",
        ({ rscale, timeZone }) => {
            const gregorian = new JsCal.Event({
                title: "Control",
                start: "2026-05-01T09:00:00",
                timeZone,
                recurrenceRules: [
                    {
                        "@type": "RecurrenceRule",
                        frequency: "yearly",
                        rscale: "gregorian",
                        byMonth: ["5"],
                        byMonthDay: [1],
                        count: 4,
                    },
                ],
            });
            const shifted = new JsCal.Event({
                title: "Shifted",
                start: "2026-05-01T09:00:00",
                timeZone,
                recurrenceRules: [
                    {
                        "@type": "RecurrenceRule",
                        frequency: "yearly",
                        rscale,
                        byMonth: ["5"],
                        byMonthDay: [1],
                        count: 4,
                    },
                ],
            });

            expect(
                expandEventIds(gregorian, "2026-01-01", "2030-12-31"),
            ).toEqual(expandEventIds(shifted, "2026-01-01", "2030-12-31"));
        },
    );

    it.each([
        {
            rscale: "japanese",
            timeZone: "Asia/Tokyo" as const,
        },
        {
            rscale: "buddhist",
            timeZone: "Asia/Bangkok" as const,
        },
        {
            rscale: "roc",
            timeZone: "Asia/Taipei" as const,
        },
    ])(
        "resolves override keys as gregorian local datetimes for $rscale",
        ({ rscale, timeZone }) => {
            const control = new JsCal.Event({
                title: "Series",
                start: "2026-05-01T09:00:00",
                timeZone,
                recurrenceRules: [
                    {
                        "@type": "RecurrenceRule",
                        frequency: "yearly",
                        rscale: "gregorian",
                        count: 3,
                    },
                ],
                recurrenceOverrides: {
                    "2027-05-01T09:00:00": { title: "Override" },
                },
            });
            const shifted = new JsCal.Event({
                title: "Series",
                start: "2026-05-01T09:00:00",
                timeZone,
                recurrenceRules: [
                    {
                        "@type": "RecurrenceRule",
                        frequency: "yearly",
                        rscale,
                        count: 3,
                    },
                ],
                recurrenceOverrides: {
                    "2027-05-01T09:00:00": { title: "Override" },
                },
            });

            expect(
                expandEventInstances(control, "2026-01-01", "2028-12-31").map(
                    (event) => ({
                        recurrenceId: event.recurrenceId,
                        title: event.title,
                    }),
                ),
            ).toEqual(
                expandEventInstances(shifted, "2026-01-01", "2028-12-31").map(
                    (event) => ({
                        recurrenceId: event.recurrenceId,
                        title: event.title,
                    }),
                ),
            );
        },
    );

    it("keeps floating wall clock time for islamic-civil monthly recurrences", () => {
        const event = new JsCal.Event({
            title: "Islamic Civil Floating",
            start: "2026-02-15T22:30:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "monthly",
                    rscale: "islamic-civil",
                    count: 4,
                },
            ],
        });

        const ids = expandEventIds(event, "2026-01-01", "2026-06-30");
        expect(ids).toHaveLength(4);
        expect(ids.every((value) => value.endsWith("T22:30:00"))).toBe(true);
        expect(ids).toEqual([...ids].sort());
        expectMonthlyCalendarProgression(ids, "islamic-civil");
    });

    it("follows calendar-local monthly progression for islamic-tbla", () => {
        const event = new JsCal.Event({
            title: "Islamic TBLA Monthly",
            start: "2026-02-15T09:00:00",
            timeZone: "Asia/Riyadh",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "monthly",
                    rscale: "islamic-tbla",
                    count: 6,
                },
            ],
        });

        const ids = expandEventIds(event, "2026-01-01", "2026-08-31");
        expect(ids).toHaveLength(6);
        expect(ids).toEqual([...ids].sort());
        expectMonthlyCalendarProgression(ids, "islamic-tbla", "Asia/Riyadh");
    });

    it("either expands or fails fast for islamic-umalqura depending on runtime support", () => {
        const event = new JsCal.Event(
            {
                title: "Umalqura Capability",
                start: "2026-03-20T09:00:00",
                timeZone: "Asia/Riyadh",
                recurrenceRules: [
                    {
                        "@type": "RecurrenceRule",
                        frequency: "yearly",
                        rscale: "islamic-umalqura",
                        byMonth: ["9"],
                        byMonthDay: [1],
                        count: 3,
                    },
                ],
            },
            { validate: false },
        );

        if (!isCalendarRuntimeAvailable("islamic-umalqura")) {
            expect(() =>
                expandEventIds(event, "2026-01-01", "2029-12-31"),
            ).toThrow("Unsupported rscale");
            return;
        }

        const ids = expandEventIds(event, "2026-01-01", "2029-12-31");
        expect(ids).toHaveLength(3);
        expect(ids).toEqual([...ids].sort());
    });

    it("projects Persian new year as month 1 day 1 in the Persian calendar", () => {
        const event = new JsCal.Event({
            title: "Persian New Year",
            start: "2026-03-21T09:00:00",
            timeZone: "Asia/Tehran",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    rscale: "persian",
                    byMonth: ["1"],
                    byMonthDay: [1],
                    count: 4,
                },
            ],
        });

        const ids = expandEventIds(event, "2026-01-01", "2030-12-31");
        expect(ids).toHaveLength(4);
        expect(
            ids.every((value) => /^20\d\d-03-(20|21|22)T09:00:00$/.test(value)),
        ).toBe(true);
        for (const id of ids) {
            const date = toCalendarDateTime(id, "persian", "Asia/Tehran");
            expect(date.monthCode).toBe("M01");
            expect(date.day).toBe(1);
        }
    });

    it("uses the last day of each Persian year for byYearDay=-1", () => {
        const expectedDates = findCalendarYearEndDates(
            "persian",
            "2026-06-01",
            3,
        );
        const event = new JsCal.Event({
            title: "Persian Year End",
            start: `${expectedDates[0]}T09:00:00`,
            timeZone: "Asia/Tehran",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    rscale: "persian",
                    byYearDay: [-1],
                    count: 3,
                },
            ],
        });

        const ids = expandEventIds(event, "2026-01-01", "2029-12-31");
        expect(ids).toEqual(expectedDates.map((value) => `${value}T09:00:00`));
    });

    it("uses the last day of each Hebrew year for byYearDay=-1", () => {
        const expectedDates = findCalendarYearEndDates(
            "hebrew",
            "2026-06-01",
            3,
        );
        const event = new JsCal.Event({
            title: "Hebrew Year End",
            start: `${expectedDates[0]}T09:00:00`,
            timeZone: "Asia/Jerusalem",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    rscale: "hebrew",
                    byYearDay: [-1],
                    count: 3,
                },
            ],
        });

        const ids = expandEventIds(event, "2026-01-01", "2029-12-31");
        expect(ids).toEqual(expectedDates.map((value) => `${value}T09:00:00`));
    });

    it("fails fast for unsupported runtime calendars instead of silently falling back", () => {
        const event = new JsCal.Event(
            {
                title: "Chinese Runtime Capability",
                start: "2026-02-01T09:00:00",
                timeZone: "Asia/Shanghai",
                recurrenceRules: [
                    {
                        "@type": "RecurrenceRule",
                        frequency: "yearly",
                        rscale: "chinese",
                        count: 2,
                    },
                ],
            },
            { validate: false },
        );

        if (isCalendarRuntimeAvailable("chinese")) {
            expect(
                expandEventIds(event, "2026-01-01", "2028-12-31"),
            ).toHaveLength(2);
            return;
        }

        expect(() => expandEventIds(event, "2026-01-01", "2028-12-31")).toThrow(
            "Unsupported rscale",
        );
    });
});

function findLeapMonthIsoDate(
    calendar: string,
): { date: string; byMonth: string; day: number } | undefined {
    if (LeapMonthIsoDateCache.has(calendar)) {
        return LeapMonthIsoDateCache.get(calendar) ?? undefined;
    }
    try {
        let cursor = Temporal.PlainDate.from("2026-01-01");
        const end = Temporal.PlainDate.from("2028-12-31");
        while (Temporal.PlainDate.compare(cursor, end) <= 0) {
            const calendarDate = cursor.withCalendar(calendar);
            if (calendarDate.monthCode.endsWith("L")) {
                const resolved = {
                    date: cursor.toString(),
                    byMonth: `${Number(calendarDate.monthCode.slice(1, -1))}L`,
                    day: calendarDate.day,
                };
                LeapMonthIsoDateCache.set(calendar, resolved);
                return resolved;
            }
            cursor = cursor.add({ days: 1 });
        }
    } catch {
        LeapMonthIsoDateCache.set(calendar, null);
        return undefined;
    }
    LeapMonthIsoDateCache.set(calendar, null);
    return undefined;
}

function findMonthTokenOccurrences(
    calendar: string,
    limit: number,
): Array<{ date: string; byMonth: string; day: number }> {
    const cacheKey = `${calendar}:${limit}`;
    const cached = MonthTokenOccurrencesCache.get(cacheKey);
    if (cached) {
        return cached;
    }
    const matches: Array<{ date: string; byMonth: string; day: number }> = [];
    const first = findLeapMonthIsoDate(calendar);
    if (!first) {
        MonthTokenOccurrencesCache.set(cacheKey, matches);
        return matches;
    }

    let cursor = Temporal.PlainDate.from(first.date);
    const end = Temporal.PlainDate.from("2036-12-31");
    while (
        Temporal.PlainDate.compare(cursor, end) <= 0 &&
        matches.length < limit
    ) {
        const calendarDate = cursor.withCalendar(calendar);
        const byMonth = `${Number(calendarDate.monthCode.slice(1, -1))}${calendarDate.monthCode.endsWith("L") ? "L" : ""}`;
        if (byMonth === first.byMonth && calendarDate.day === first.day) {
            matches.push({
                date: cursor.toString(),
                byMonth,
                day: calendarDate.day,
            });
        }
        cursor = cursor.add({ days: 1 });
    }

    MonthTokenOccurrencesCache.set(cacheKey, matches);
    return matches;
}

function findMonthDayTokenDate(
    calendar: string,
    monthToken: string,
    day: number,
): string | undefined {
    const cacheKey = `${calendar}:${monthToken}:${day}`;
    if (MonthDayTokenDateCache.has(cacheKey)) {
        return MonthDayTokenDateCache.get(cacheKey) ?? undefined;
    }
    try {
        let cursor = Temporal.PlainDate.from("2026-01-01");
        const end = Temporal.PlainDate.from("2036-12-31");
        while (Temporal.PlainDate.compare(cursor, end) <= 0) {
            const calendarDate = cursor.withCalendar(calendar);
            const token = `${Number(calendarDate.monthCode.slice(1, calendarDate.monthCode.endsWith("L") ? -1 : undefined))}${calendarDate.monthCode.endsWith("L") ? "L" : ""}`;
            if (token === monthToken && calendarDate.day === day) {
                const resolved = cursor.toString();
                MonthDayTokenDateCache.set(cacheKey, resolved);
                return resolved;
            }
            cursor = cursor.add({ days: 1 });
        }
    } catch {
        MonthDayTokenDateCache.set(cacheKey, null);
        return undefined;
    }
    MonthDayTokenDateCache.set(cacheKey, null);
    return undefined;
}

function expandEventInstances(
    event: InstanceType<typeof JsCal.Event>,
    from: string,
    to: string,
    includeAnchor = true,
): Event[] {
    return collect(
        JsCal.expandRecurrence(
            [event],
            {
                from: new Date(`${from}T00:00:00Z`),
                to: new Date(`${to}T23:59:59Z`),
            },
            { includeAnchor },
        ),
    );
}

function expandEventIds(
    event: InstanceType<typeof JsCal.Event>,
    from: string,
    to: string,
    includeAnchor = true,
): string[] {
    return expandEventInstances(event, from, to, includeAnchor).flatMap(
        (value) => (value.recurrenceId ? [value.recurrenceId] : []),
    );
}

function isCalendarRuntimeAvailable(calendar: string): boolean {
    const cached = RuntimeCalendarAvailabilityCache.get(calendar);
    if (cached !== undefined) {
        return cached;
    }
    try {
        Temporal.PlainDate.from({
            calendar,
            year: 2026,
            month: 1,
            day: 1,
        });
        RuntimeCalendarAvailabilityCache.set(calendar, true);
        return true;
    } catch {
        RuntimeCalendarAvailabilityCache.set(calendar, false);
        return false;
    }
}

function toCalendarDateTime(
    localDateTime: string,
    calendar: string,
    timeZone?: string,
): PlainDateTime | ZonedDateTime {
    const cacheKey = `${calendar}|${timeZone ?? ""}|${localDateTime}`;
    const cached = CalendarDateTimeCache.get(cacheKey);
    if (cached) {
        return cached;
    }
    const plain = Temporal.PlainDateTime.from(localDateTime);
    if (timeZone) {
        const converted = plain
            .toZonedDateTime(timeZone)
            .withCalendar(calendar);
        CalendarDateTimeCache.set(cacheKey, converted);
        return converted;
    }
    const converted = plain.withCalendar(calendar);
    CalendarDateTimeCache.set(cacheKey, converted);
    return converted;
}

function expectMonthlyCalendarProgression(
    values: string[],
    calendar: string,
    timeZone?: string,
): void {
    for (let i = 1; i < values.length; i += 1) {
        const previousValue = values[i - 1];
        const currentValue = values[i];
        if (!previousValue || !currentValue) {
            continue;
        }
        const previous = toCalendarDateTime(previousValue, calendar, timeZone);
        const current = toCalendarDateTime(currentValue, calendar, timeZone);
        const expected = previous.add({ months: 1 });
        expect(current.year).toBe(expected.year);
        expect(current.monthCode).toBe(expected.monthCode);
        expect(current.day).toBe(expected.day);
        expect(current.hour).toBe(expected.hour);
        expect(current.minute).toBe(expected.minute);
        expect(current.second).toBe(expected.second);
    }
}

function findCalendarYearEndDates(
    calendar: string,
    referenceDate: string,
    count: number,
): string[] {
    const cacheKey = `${calendar}:${referenceDate}:${count}`;
    const cached = CalendarYearEndDatesCache.get(cacheKey);
    if (cached) {
        return cached;
    }
    const reference =
        Temporal.PlainDate.from(referenceDate).withCalendar(calendar);
    const result: string[] = [];
    for (let i = 0; i < count; i += 1) {
        const year = reference.year + i;
        const nextYearStart = Temporal.PlainDate.from({
            calendar,
            year: year + 1,
            month: 1,
            day: 1,
        });
        result.push(
            nextYearStart
                .subtract({ days: 1 })
                .withCalendar("iso8601")
                .toString(),
        );
    }
    CalendarYearEndDatesCache.set(cacheKey, result);
    return result;
}

function addIsoDays(value: string, days: number): string {
    return Temporal.PlainDate.from(value).add({ days }).toString();
}

function buildDailyExpectedIds(start: string, count: number): string[] {
    const result: string[] = [];
    for (let i = 0; i < count; i += 1) {
        result.push(`${addIsoDays(start, i)}T09:00:00`);
    }
    return result;
}

function gregorianMonthStartRows(
    rscale: string,
): GregorianMonthStartExpectation[] {
    const cached = GregorianMonthStartRowsCache.get(rscale);
    if (cached) {
        return cached;
    }
    const calendar = resolveRscaleDefinition(rscale).calendarId;
    const result: GregorianMonthStartExpectation[] = [];
    let monthStart = Temporal.PlainDate.from("2026-06-01");
    const end = Temporal.PlainDate.from("2027-06-01");

    while (Temporal.PlainDate.compare(monthStart, end) <= 0) {
        const current = monthStart.withCalendar(calendar);
        result.push(
            row(
                monthStart.toString(),
                current.year,
                current.monthCode,
                current.day,
            ),
        );
        monthStart = monthStart.add({ months: 1 });
    }

    GregorianMonthStartRowsCache.set(rscale, result);
    return result;
}

function expectSelectorOccurrences(
    rscale: string,
    rule: import("../types.js").RecurrenceRule,
    expected: OccurrenceExpectation[],
): void {
    const event = new JsCal.Event(
        {
            title: `${rscale} Selector`,
            start: "2026-06-15T09:00:00",
            recurrenceRules: [rule],
        },
        rscale === "gregorian" ? undefined : { validate: false },
    );

    if (rscale !== "gregorian" && !isCalendarRuntimeAvailable(rscale)) {
        expect(() =>
            expandEventInstances(event, "2026-06-01", "2027-06-30", false),
        ).toThrow("Unsupported rscale");
        return;
    }

    const actual = expandEventInstances(
        event,
        "2026-06-01",
        "2027-06-30",
        false,
    ).flatMap((value) =>
        value.recurrenceId
            ? [{ gregorian: value.recurrenceId.slice(0, 10) }]
            : [],
    );

    expect(actual).toEqual(expected);
}

function expectTimeSelectorOccurrences(
    rscale: string,
    selector: {
        byHour?: number[];
        byMinute?: number[];
        bySecond?: number[];
    },
    expected: OccurrenceExpectation[],
): void {
    const event = new JsCal.Event(
        {
            title: `${rscale} Time Selector`,
            start: "2026-06-15T09:10:20",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "daily",
                    rscale,
                    count: 3,
                    ...selector,
                },
            ],
        },
        rscale === "gregorian" ? undefined : { validate: false },
    );

    if (rscale !== "gregorian" && !isCalendarRuntimeAvailable(rscale)) {
        expect(() =>
            expandEventInstances(event, "2026-06-15", "2026-06-18", true),
        ).toThrow("Unsupported rscale");
        return;
    }

    const actual = expandEventInstances(
        event,
        "2026-06-15",
        "2026-06-18",
        true,
    ).flatMap((value) =>
        value.recurrenceId ? [{ gregorian: value.recurrenceId }] : [],
    );

    expect(actual).toEqual(expected);
}

function expectSetPositionOccurrences(
    rscale: string,
    rule: import("../types.js").RecurrenceRule,
): void {
    const event = new JsCal.Event(
        {
            title: `${rscale} Set Position`,
            start: "2026-06-01T09:00:00",
            recurrenceRules: [rule],
        },
        rscale === "gregorian" ? undefined : { validate: false },
    );

    if (rscale !== "gregorian" && !isCalendarRuntimeAvailable(rscale)) {
        expect(() => expandEventIds(event, "2026-06-01", "2026-12-31")).toThrow(
            "Unsupported rscale",
        );
        return;
    }

    const { bySetPosition: _bySetPosition, count: _count, ...baseRule } = rule;
    const baseEvent = new JsCal.Event(
        {
            title: `${rscale} Base Set Position`,
            start: "2026-06-01T09:00:00",
            recurrenceRules: [baseRule],
        },
        rscale === "gregorian" ? undefined : { validate: false },
    );

    const actual = expandEventIds(event, "2026-06-01", "2026-12-31");
    const baseIds = expandEventIds(baseEvent, "2026-06-01", "2026-12-31");
    const expected = selectPositionsByCalendarMonth(
        baseIds,
        resolveRscaleDefinition(rscale).calendarId,
        [1, -1],
    ).slice(0, actual.length);

    expect(actual).toEqual(expected);
}

function expectCompositeMonthDayOccurrences(
    rscale: string,
    monthToken: string,
    monthDay: number,
    time: string,
    count: number,
): void {
    const calendar = resolveRscaleDefinition(rscale).calendarId;
    const event = new JsCal.Event(
        {
            title: `${rscale} Composite`,
            start: "2026-06-15T09:00:00",
            recurrenceRules: [
                {
                    "@type": "RecurrenceRule",
                    frequency: "yearly",
                    rscale,
                    byMonth: [monthToken],
                    byMonthDay: [monthDay],
                    byHour: [Number(time.slice(0, 2))],
                    byMinute: [Number(time.slice(3, 5))],
                    bySecond: [Number(time.slice(6, 8))],
                    count,
                },
            ],
        },
        rscale === "gregorian" ? undefined : { validate: false },
    );

    if (rscale !== "gregorian" && !isCalendarRuntimeAvailable(rscale)) {
        expect(() =>
            expandEventIds(event, "2026-06-01", "2030-12-31", false),
        ).toThrow("Unsupported rscale");
        return;
    }

    const expectedDates = findMonthDayOccurrences(
        calendar,
        monthToken,
        monthDay,
        count,
    );
    const expected = expectedDates.map((date) => `${date}T${time}`);

    expect(expandEventIds(event, "2026-06-01", "2030-12-31", false)).toEqual(
        expected,
    );
}

function selectPositionsByCalendarMonth(
    ids: string[],
    calendar: string,
    positions: number[],
    timeZone?: string,
): string[] {
    const groups = new Map<string, string[]>();
    for (const id of ids) {
        const current = toCalendarDateTime(id, calendar, timeZone);
        const key = `${current.year}-${current.monthCode}`;
        const existing = groups.get(key);
        if (existing) {
            existing.push(id);
            continue;
        }
        groups.set(key, [id]);
    }

    const result: string[] = [];
    for (const values of groups.values()) {
        const selected = new Set<string>();
        for (const position of positions) {
            const index =
                position > 0 ? position - 1 : values.length + position;
            const value = values[index];
            if (value) {
                selected.add(value);
            }
        }
        result.push(...[...selected]);
    }
    return result;
}

function findMonthDayOccurrences(
    calendar: string,
    monthToken: string,
    monthDay: number,
    limit: number,
): string[] {
    const cacheKey = `${calendar}:${monthToken}:${monthDay}:${limit}`;
    const cached = MonthDayOccurrencesCache.get(cacheKey);
    if (cached) {
        return cached;
    }
    const result: string[] = [];
    let cursor = Temporal.PlainDate.from("2026-06-01");
    const end = Temporal.PlainDate.from("2036-12-31");

    while (
        Temporal.PlainDate.compare(cursor, end) <= 0 &&
        result.length < limit
    ) {
        const current = cursor.withCalendar(calendar);
        const token = toMonthToken(current.monthCode);
        if (token === monthToken && current.day === monthDay) {
            result.push(cursor.toString());
        }
        cursor = cursor.add({ days: 1 });
    }

    MonthDayOccurrencesCache.set(cacheKey, result);
    return result;
}

function toMonthToken(monthCode: string): string {
    return `${Number(monthCode.slice(1, monthCode.endsWith("L") ? -1 : undefined))}${monthCode.endsWith("L") ? "L" : ""}`;
}

function expectWeekNumberOccurrences(
    rscale: string,
    wkst: "mo" | "su",
    rule: import("../types.js").RecurrenceRule,
): void {
    const calendar = resolveRscaleDefinition(rscale).calendarId;
    const event = new JsCal.Event(
        {
            title: `${rscale} Week Number`,
            start: "2026-06-15T09:00:00",
            recurrenceRules: [rule],
        },
        rscale === "gregorian" ? undefined : { validate: false },
    );

    if (rscale !== "gregorian" && !isCalendarRuntimeAvailable(rscale)) {
        expect(() =>
            expandEventIds(event, "2026-06-01", "2028-12-31", false),
        ).toThrow("Unsupported rscale");
        return;
    }

    const ids = expandEventIds(event, "2026-06-01", "2028-12-31", false);
    for (const id of ids) {
        const current = toCalendarDateTime(id, calendar);
        expect(current.dayOfWeek).toBe(1);
        expect(calendarWeekNumber(id, calendar, wkst)).toBe(1);
    }
}

function calendarWeekNumber(
    localDateTime: string,
    calendar: string,
    wkst: "mo" | "su",
): number {
    const cacheKey = `${calendar}:${wkst}:${localDateTime.slice(0, 10)}`;
    const cached = CalendarWeekNumberCache.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }
    const current = Temporal.PlainDate.from(
        localDateTime.slice(0, 10),
    ).withCalendar(calendar);
    const weekStart = weekStartForYear(current.year, calendar, wkst);
    const currentStart = startOfWeek(current, wkst);
    const days = currentStart.since(weekStart, { largestUnit: "days" }).days;
    const weekNumber = Math.floor(days / 7) + 1;
    CalendarWeekNumberCache.set(cacheKey, weekNumber);
    return weekNumber;
}

function weekStartForYear(
    year: number,
    calendar: string,
    wkst: "mo" | "su",
): PlainDate {
    const cacheKey = `${calendar}:${year}:${wkst}`;
    const cached = WeekStartForYearCache.get(cacheKey);
    if (cached) {
        return cached;
    }
    const januaryFourth = Temporal.PlainDate.from({
        calendar,
        year,
        month: 1,
        day: 4,
    });
    const weekStart = startOfWeek(januaryFourth, wkst);
    WeekStartForYearCache.set(cacheKey, weekStart);
    return weekStart;
}

function startOfWeek(date: PlainDate, wkst: "mo" | "su"): PlainDate {
    const offset = (date.dayOfWeek - weekStartDayNumber(wkst) + 7) % 7;
    return date.subtract({ days: offset });
}

function weekStartDayNumber(wkst: "mo" | "su"): number {
    return wkst === "mo" ? 1 : 7;
}

function expectSameIdsWithAndWithoutTimeZone(
    rscale: string,
    timeZone: TimeZoneId,
    rule: import("../types.js").RecurrenceRule,
): void {
    const floating = new JsCal.Event(
        {
            title: `${rscale} Floating`,
            start: "2026-06-15T09:00:00",
            recurrenceRules: [{ ...rule, rscale }],
        },
        rscale === "gregorian" ? undefined : { validate: false },
    );
    const zoned = new JsCal.Event(
        {
            title: `${rscale} Zoned`,
            start: "2026-06-15T09:00:00",
            timeZone,
            recurrenceRules: [{ ...rule, rscale }],
        },
        rscale === "gregorian" ? undefined : { validate: false },
    );

    if (rscale !== "gregorian" && !isCalendarRuntimeAvailable(rscale)) {
        expect(() =>
            expandEventIds(zoned, "2026-06-01", "2028-12-31", false),
        ).toThrow("Unsupported rscale");
        return;
    }

    expect(expandEventIds(zoned, "2026-06-01", "2028-12-31", false)).toEqual(
        expandEventIds(floating, "2026-06-01", "2028-12-31", false),
    );
}
