import type {
    Event,
    Group,
    JSCalendarObject,
    Task,
    TimeZoneInput,
    UTCDateTime,
} from "../types.js";

export type CreateOptions = {
    now?: () => UTCDateTime;
    validate?: boolean;
};

export type UpdateOptions = {
    touch?: boolean;
    sequence?: boolean;
    now?: () => UTCDateTime;
    validate?: boolean;
};

export type DateInput = string | Date;
export type DurationInput = string | number;
export type EntryInput = Event | Task | { data: Event | Task };
export type EventInput = Omit<
    Event,
    "@type" | "uid" | "updated" | "created" | "start" | "duration" | "timeZone"
> & {
    start: DateInput;
    duration?: DurationInput;
    timeZone?: TimeZoneInput | null;
    uid?: string;
    updated?: DateInput;
    created?: DateInput;
};
export type TaskInput = Omit<
    Task,
    "@type" | "uid" | "updated" | "created" | "start" | "due" | "timeZone"
> & {
    uid?: string;
    updated?: DateInput;
    created?: DateInput;
    start?: DateInput;
    due?: DateInput;
    timeZone?: TimeZoneInput | null;
};
export type GroupInput = Omit<
    Group,
    "@type" | "uid" | "updated" | "created" | "entries"
> & {
    entries: EntryInput[];
    uid?: string;
    updated?: DateInput;
    created?: DateInput;
};
