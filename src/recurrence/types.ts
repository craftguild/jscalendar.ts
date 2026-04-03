export type RecurrenceRange = {
    from: Date;
    to: Date;
};

export type RecurrenceExpandOptions = {
    includeAnchor?: boolean;
};

export type RecurrencePage = {
    items: import("../types.js").JSCalendarObject[];
    nextCursor?: string;
};

export type RecurrencePageOptions = RecurrenceExpandOptions & {
    limit: number;
    cursor?: string;
};

export type DayOfWeek = "mo" | "tu" | "we" | "th" | "fr" | "sa" | "su";

export type {
    CalendarBackend,
    CalendarDateCandidate as DateCandidate,
    CalendarDateParts,
    CalendarDateTimeParts as DateTime,
    CalendarMonthCode,
} from "./calendar/types.js";
