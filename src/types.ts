export type { TimeZoneId, TimeZoneInput } from "./timezones.js";

export type Id = string;
export type Int = number;
export type UnsignedInt = number;
export type UTCDateTime = string;
export type LocalDateTime = string;
export type Duration = string;
export type SignedDuration = string;

export type BooleanMap = Record<string, true>;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
    | JsonPrimitive
    | JsonValue[]
    | { [key: string]: JsonValue };
export type PatchValue = JsonValue | null;
export interface PatchObject {
    [key: string]: PatchValue;
}

type PatchFields<T> = {
    [K in keyof Omit<T, "@type">]?: T[K] | null;
};

type PatchTag<TTag extends string> = { __patchType?: TTag };

export type EventPatch = PatchFields<Event> & PatchTag<"Event">;
export type TaskPatch = PatchFields<Task> & PatchTag<"Task">;
export type GroupPatch = PatchFields<Group> & PatchTag<"Group">;
export type ParticipantPatch = PatchFields<Participant>;
export type LocationPatch = PatchFields<Location>;
export type VirtualLocationPatch = PatchFields<VirtualLocation>;
export type AlertPatch = PatchFields<Alert>;
export type RelationPatch = PatchFields<Relation>;
export type LinkPatch = PatchFields<Link>;
export type TimeZonePatch = PatchFields<TimeZone>;
export type TimeZoneRulePatch = PatchFields<TimeZoneRule>;
export type RecurrenceRulePatch = PatchFields<RecurrenceRule>;
export type NDayPatch = PatchFields<NDay>;

export type PatchLike =
    | PatchObject
    | EventPatch
    | TaskPatch
    | GroupPatch
    | TimeZoneRulePatch;

export interface Relation {
    "@type": "Relation";
    relation?: BooleanMap;
}

export interface Link {
    "@type": "Link";
    href: string;
    cid?: string;
    contentType?: string;
    size?: UnsignedInt;
    rel?: string;
    display?: string;
    title?: string;
}

export interface Location {
    "@type": "Location";
    name?: string;
    description?: string;
    locationTypes?: BooleanMap;
    relativeTo?: string;
    timeZone?: TimeZoneId;
    coordinates?: string;
    links?: Record<Id, Link>;
}

export interface VirtualLocation {
    "@type": "VirtualLocation";
    name?: string;
    description?: string;
    uri: string;
    features?: BooleanMap;
}

export interface Participant {
    "@type": "Participant";
    name?: string;
    email?: string;
    description?: string;
    sendTo?: Record<string, string>;
    kind?: string;
    roles: BooleanMap;
    locationId?: Id;
    language?: string;
    participationStatus?: string;
    participationComment?: string;
    expectReply?: boolean;
    scheduleAgent?: string;
    scheduleForceSend?: boolean;
    scheduleSequence?: UnsignedInt;
    scheduleStatus?: string[];
    scheduleUpdated?: UTCDateTime;
    sentBy?: string;
    invitedBy?: Id;
    delegatedTo?: Record<Id, true>;
    delegatedFrom?: Record<Id, true>;
    memberOf?: Record<Id, true>;
    links?: Record<Id, Link>;
    progress?: string;
    progressUpdated?: UTCDateTime;
    percentComplete?: UnsignedInt;
}

export interface OffsetTrigger {
    "@type": "OffsetTrigger";
    offset: SignedDuration;
    relativeTo?: "start" | "end" | string;
}

export interface AbsoluteTrigger {
    "@type": "AbsoluteTrigger";
    when: UTCDateTime;
}

export interface UnknownTrigger {
    "@type": string;
    [key: string]: JsonValue;
}

export type Trigger = OffsetTrigger | AbsoluteTrigger | UnknownTrigger;

export interface Alert {
    "@type": "Alert";
    trigger: Trigger;
    acknowledged?: UTCDateTime;
    relatedTo?: Record<string, Relation>;
    action?: string;
}

export type DayOfWeek = "mo" | "tu" | "we" | "th" | "fr" | "sa" | "su";

export interface NDay {
    "@type": "NDay";
    day: DayOfWeek;
    nthOfPeriod?: Int;
}

export interface RecurrenceRule {
    "@type": "RecurrenceRule";
    frequency:
        | "yearly"
        | "monthly"
        | "weekly"
        | "daily"
        | "hourly"
        | "minutely"
        | "secondly";
    interval?: UnsignedInt;
    rscale?: string;
    skip?: "omit" | "backward" | "forward";
    firstDayOfWeek?: DayOfWeek;
    byDay?: NDay[];
    byMonthDay?: Int[];
    byMonth?: string[];
    byYearDay?: Int[];
    byWeekNo?: Int[];
    byHour?: UnsignedInt[];
    byMinute?: UnsignedInt[];
    bySecond?: UnsignedInt[];
    bySetPosition?: Int[];
    count?: UnsignedInt;
    until?: LocalDateTime;
}

export interface TimeZoneRule {
    "@type": "TimeZoneRule";
    start: LocalDateTime;
    offsetFrom: string;
    offsetTo: string;
    recurrenceRules?: RecurrenceRule[];
    recurrenceOverrides?: Record<LocalDateTime, TimeZoneRulePatch>;
    names?: BooleanMap;
    comments?: string[];
}

export interface TimeZone {
    "@type": "TimeZone";
    tzId: string;
    updated?: UTCDateTime;
    url?: string;
    validUntil?: UTCDateTime;
    aliases?: BooleanMap;
    standard?: TimeZoneRule[];
    daylight?: TimeZoneRule[];
}

export interface JSCalendarCommon {
    "@type": string;
    uid: string;
    relatedTo?: Record<string, Relation>;
    prodId?: string;
    created?: UTCDateTime;
    updated: UTCDateTime;
    sequence?: UnsignedInt;
    method?: string;
    title?: string;
    description?: string;
    descriptionContentType?: string;
    showWithoutTime?: boolean;
    locations?: Record<Id, Location>;
    virtualLocations?: Record<Id, VirtualLocation>;
    links?: Record<Id, Link>;
    locale?: string;
    keywords?: BooleanMap;
    categories?: BooleanMap;
    color?: string;
    recurrenceId?: LocalDateTime;
    recurrenceIdTimeZone?: TimeZoneId | null;
    recurrenceRules?: RecurrenceRule[];
    excludedRecurrenceRules?: RecurrenceRule[];
    excluded?: boolean;
    priority?: Int;
    freeBusyStatus?: string;
    privacy?: string;
    replyTo?: Record<string, string>;
    sentBy?: string;
    participants?: Record<Id, Participant>;
    requestStatus?: string;
    useDefaultAlerts?: boolean;
    alerts?: Record<Id, Alert>;
    timeZone?: TimeZoneId | null;
    timeZones?: Partial<Record<TimeZoneId, TimeZone>>;
}

export interface Event extends JSCalendarCommon {
    "@type": "Event";
    start: LocalDateTime;
    duration?: Duration;
    status?: string;
    localizations?: Record<string, EventPatch>;
    recurrenceOverrides?: Record<LocalDateTime, EventPatch>;
}

export interface Task extends JSCalendarCommon {
    "@type": "Task";
    due?: LocalDateTime;
    start?: LocalDateTime;
    estimatedDuration?: Duration;
    percentComplete?: UnsignedInt;
    progress?: string;
    progressUpdated?: UTCDateTime;
    localizations?: Record<string, TaskPatch>;
    recurrenceOverrides?: Record<LocalDateTime, TaskPatch>;
}

export interface Group extends JSCalendarCommon {
    "@type": "Group";
    entries: Array<Event | Task>;
    source?: string;
    localizations?: Record<string, GroupPatch>;
    recurrenceOverrides?: Record<LocalDateTime, GroupPatch>;
}

export type JSCalendarObject = Event | Task | Group;

export type CalendarType = JSCalendarObject["@type"];

export type CreateInput<TType extends CalendarType> = TType extends "Event"
    ? Omit<Event, "@type" | "uid" | "updated"> & {
          type?: "Event" | "event";
          "@type"?: "Event";
          uid?: string;
          updated?: UTCDateTime;
      }
    : TType extends "Task"
      ? Omit<Task, "@type" | "uid" | "updated"> & {
            type?: "Task" | "task";
            "@type"?: "Task";
            uid?: string;
            updated?: UTCDateTime;
        }
      : Omit<Group, "@type" | "uid" | "updated"> & {
            type?: "Group" | "group";
            "@type"?: "Group";
            uid?: string;
            updated?: UTCDateTime;
        };

export type AnyCreateInput =
    | CreateInput<"Event">
    | CreateInput<"Task">
    | CreateInput<"Group">;

export type CalendarLike = JSCalendarObject | PatchObject | JsonValue;
