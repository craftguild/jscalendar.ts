export const Z_SUFFIX = "Z";
export const CHARSET_KEY = "charset";
export const UTF8 = "utf-8";
export const RSCALE_GREGORIAN = "gregorian";
export const TYPE_NDAY = "NDay";
export const TYPE_RECURRENCE_RULE = "RecurrenceRule";
export const TYPE_ALERT = "Alert";
export const TYPE_OFFSET_TRIGGER = "OffsetTrigger";
export const TYPE_ABSOLUTE_TRIGGER = "AbsoluteTrigger";
export const TYPE_RELATION = "Relation";
export const TYPE_LINK = "Link";
export const TYPE_LOCATION = "Location";
export const TYPE_VIRTUAL_LOCATION = "VirtualLocation";
export const TYPE_TIME_ZONE_RULE = "TimeZoneRule";
export const TYPE_TIME_ZONE = "TimeZone";
export const TYPE_PARTICIPANT = "Participant";
export const TYPE_EVENT = "Event";
export const TYPE_TASK = "Task";
export const TYPE_GROUP = "Group";

export const DATE_TIME =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z)?$/;
export const DURATION =
    /^-?P(?:(\d+)W(?:(\d+)D)?|(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)(?:\.(\d+))?S)?)?$/;

export const DAY_OF_WEEK = new Set(["mo", "tu", "we", "th", "fr", "sa", "su"]);
export const RECURRENCE_FREQUENCY = new Set([
    "yearly",
    "monthly",
    "weekly",
    "daily",
    "hourly",
    "minutely",
    "secondly",
]);
export const SKIP = new Set(["omit", "backward", "forward"]);
export const ID_PATTERN = /^[A-Za-z0-9_-]+$/;
