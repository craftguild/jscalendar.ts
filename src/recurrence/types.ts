export type RecurrenceRange = {
  from: Date;
  to: Date;
};

export type RecurrencePage = {
  items: import("../types.js").JSCalendarObject[];
  nextCursor?: string;
};

export type RecurrencePageOptions = {
  limit: number;
  cursor?: string;
};

export type DayOfWeek = "mo" | "tu" | "we" | "th" | "fr" | "sa" | "su";

export type DateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export type DateCandidate = {
  year: number;
  month: number;
  day: number;
  valid: boolean;
};
