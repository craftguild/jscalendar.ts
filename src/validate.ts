import type {
  Alert,
  Event,
  Group,
  JSCalendarObject,
  JsonValue,
  Link,
  Location,
  NDay,
  Participant,
  PatchObject,
  RecurrenceRule,
  Relation,
  Task,
  TimeZone,
  TimeZoneRule,
  VirtualLocation,
} from "./types.js";
import { TimeZones } from "./timezones.js";

export class ValidationError extends Error {
  path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "ValidationError";
    this.path = path;
  }
}

const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z)?$/;
const DURATION = /^-?P(?:(\d+)W(?:(\d+)D)?|(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)(?:\.(\d+))?S)?)?$/;

const DAY_OF_WEEK = new Set(["mo", "tu", "we", "th", "fr", "sa", "su"]);
const RECURRENCE_FREQUENCY = new Set([
  "yearly",
  "monthly",
  "weekly",
  "daily",
  "hourly",
  "minutely",
  "secondly",
]);
const SKIP = new Set(["omit", "backward", "forward"]);
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function utf8Length(value: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).length;
  }
  return value.length;
}

function fail(path: string, message: string): never {
  throw new ValidationError(path, message);
}

function isRecord(value: object | null | undefined): value is Record<string, JsonValue> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function assertString(value: string | null | undefined, path: string): void {
  if (value === undefined || value === null) return;
  if (typeof value !== "string") fail(path, "must be a string");
}

function assertNonEmptyString(value: string | undefined, path: string): void {
  if (value === undefined) return;
  if (typeof value !== "string") fail(path, "must be a string");
  if (value.length === 0) fail(path, "must not be empty");
}

function assertId(value: string | undefined, path: string): void {
  if (value === undefined) return;
  if (typeof value !== "string") fail(path, "must be an Id");
  const length = utf8Length(value);
  if (length < 1 || length > 255) fail(path, "must be between 1 and 255 octets");
  if (!ID_PATTERN.test(value)) fail(path, "must use base64url characters");
}

function assertBoolean(value: boolean | null | undefined, path: string): void {
  if (value === undefined || value === null) return;
  if (typeof value !== "boolean") fail(path, "must be a boolean");
}

function assertInteger(value: number | null | undefined, path: string): void {
  if (value === undefined || value === null) return;
  if (typeof value !== "number" || !Number.isInteger(value)) fail(path, "must be an integer");
}

function assertUnsignedInt(value: number | null | undefined, path: string): void {
  if (value === undefined || value === null) return;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    fail(path, "must be a non-negative integer");
  }
}

function assertDateTime(value: string | undefined, path: string, requireZ: boolean): void {
  if (value === undefined) return;
  if (typeof value !== "string") fail(path, "must be a date-time string");
  const match = value.match(DATE_TIME);
  if (!match) {
    fail(path, requireZ ? "must be a UTCDateTime (YYYY-MM-DDTHH:mm:ssZ)" : "must be a LocalDateTime (YYYY-MM-DDTHH:mm:ss)");
  }
  const [, year, month, day, hour, minute, second, fraction, zFlag] = match;
  if (requireZ && zFlag !== "Z") fail(path, "must use Z suffix");
  if (!requireZ && zFlag) fail(path, "must not include time zone offset");
  const monthNum = Number.parseInt(month ?? "0", 10);
  const dayNum = Number.parseInt(day ?? "0", 10);
  const hourNum = Number.parseInt(hour ?? "0", 10);
  const minuteNum = Number.parseInt(minute ?? "0", 10);
  const secondNum = Number.parseInt(second ?? "0", 10);
  if (monthNum < 1 || monthNum > 12) fail(path, "month must be 01-12");
  if (dayNum < 1 || dayNum > 31) fail(path, "day must be 01-31");
  if (hourNum < 0 || hourNum > 23) fail(path, "hour must be 00-23");
  if (minuteNum < 0 || minuteNum > 59) fail(path, "minute must be 00-59");
  if (secondNum < 0 || secondNum > 59) fail(path, "second must be 00-59");
  if (fraction !== undefined) {
    if (fraction.length > 9) fail(path, "fractional seconds must be 1-9 digits");
    if (/^0+$/.test(fraction)) fail(path, "fractional seconds must be non-zero");
    if (fraction.endsWith("0")) fail(path, "fractional seconds must not have trailing zeros");
  }
}

function assertLocalDateTime(value: string | undefined, path: string): void {
  return assertDateTime(value, path, false);
}

function assertUtcDateTime(value: string | undefined, path: string): void {
  return assertDateTime(value, path, true);
}

function assertDurationLike(value: string | undefined, path: string, signed: boolean): void {
  if (value === undefined) return;
  if (typeof value !== "string") fail(path, "must be a duration string");
  if (!signed && value.startsWith("-")) fail(path, "must not be negative");
  const match = value.match(DURATION);
  if (!match) fail(path, "must be an ISO 8601 duration");
  const week = match[1];
  const dayFromWeek = match[2];
  const day = match[3];
  const hour = match[4];
  const minute = match[5];
  const second = match[6];
  const fraction = match[7];
  const hasDate = !!week || !!dayFromWeek || !!day;
  const hasTime = !!hour || !!minute || !!second;
  if (!hasDate && !hasTime) fail(path, "must include at least one duration component");
  if (fraction !== undefined) {
    if (fraction.length > 9) fail(path, "fractional seconds must be 1-9 digits");
    if (/^0+$/.test(fraction)) fail(path, "fractional seconds must be non-zero");
    if (fraction.endsWith("0")) fail(path, "fractional seconds must not have trailing zeros");
  }
}

function assertDuration(value: string | undefined, path: string): void {
  return assertDurationLike(value, path, false);
}

function assertSignedDuration(value: string | undefined, path: string): void {
  return assertDurationLike(value, path, true);
}

function assertBooleanMap(value: object | undefined, path: string): void {
  if (value === undefined) return;
  if (!isRecord(value)) fail(path, "must be a boolean map object");
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== true) fail(`${path}.${key}`, "must be true");
  }
}

function assertIdBooleanMap(value: object | undefined, path: string): void {
  if (value === undefined) return;
  if (!isRecord(value)) fail(path, "must be a boolean map object");
  for (const [key, entry] of Object.entries(value)) {
    assertId(key, `${path}.${key}`);
    if (entry !== true) fail(`${path}.${key}`, "must be true");
  }
}

function assertMediaType(value: string | undefined, path: string): void {
  if (value === undefined) return;
  if (typeof value !== "string") fail(path, "must be a media type string");
  const [typePart, ...params] = value.split(";");
  const mediaType = (typePart ?? "").trim();
  if (!/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(mediaType)) {
    fail(path, "must be a valid media type");
  }
  for (const param of params) {
    const [rawKey, rawValue] = param.split("=");
    if (!rawKey || !rawValue) continue;
    const key = rawKey.trim().toLowerCase();
    const valuePart = rawValue.trim().toLowerCase();
    if (key === "charset" && valuePart !== "utf-8") {
      fail(path, "charset parameter must be utf-8");
    }
  }
}

function assertTextContentType(value: string | undefined, path: string): void {
  if (value === undefined) return;
  if (typeof value !== "string") fail(path, "must be a media type string");
  const [typePart] = value.split(";");
  const mediaType = (typePart ?? "").trim();
  if (!mediaType.startsWith("text/")) fail(path, "must be a text/* media type");
  assertMediaType(value, path);
}

function assertContentId(value: string | undefined, path: string): void {
  if (value === undefined) return;
  if (typeof value !== "string") fail(path, "must be a content-id");
  const trimmed = value.trim();
  const hasBrackets = trimmed.startsWith("<") || trimmed.endsWith(">");
  if (hasBrackets && !(trimmed.startsWith("<") && trimmed.endsWith(">"))) {
    fail(path, "must use matching angle brackets");
  }
  const raw = hasBrackets ? trimmed.slice(1, -1) : trimmed;
  if (!/^[^\s<>@]+@[^\s<>@]+$/.test(raw)) {
    fail(path, "must be a content-id");
  }
}

function assertTimeZone(value: string | null | undefined, path: string): void {
  if (value === undefined || value === null) return;
  if (typeof value !== "string") fail(path, "must be a time zone ID");
  for (const tz of TimeZones) {
    if (tz === value) return;
  }
  fail(path, "must be a supported time zone ID");
}

function assertJsonValue(value: JsonValue | object | null | undefined, path: string): void {
  if (value === undefined) fail(path, "must be a JSON value");
  if (value === null) return;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertJsonValue(entry, `${path}[${index}]`));
    return;
  }
  if (typeof value === "object") {
    if (!isRecord(value)) fail(path, "must be a JSON object");
    for (const [key, entry] of Object.entries(value)) {
      assertJsonValue(entry, `${path}.${key}`);
    }
    return;
  }
  fail(path, "must be a JSON value");
}

function assertPatchObject(value: PatchObject | undefined, path: string): void {
  if (value === undefined) return;
  if (!isRecord(value)) fail(path, "must be a PatchObject");
  for (const [key, entry] of Object.entries(value)) {
    if (entry === null) continue;
    assertJsonValue(entry, `${path}.${key}`);
  }
}

function validateNDay(value: NDay, path: string): void {
  if (value["@type"] !== "NDay") fail(path, "must have @type NDay");
  if (!DAY_OF_WEEK.has(value.day)) fail(`${path}.day`, "must be a valid day of week");
  assertInteger(value.nthOfPeriod, `${path}.nthOfPeriod`);
}

function validateRecurrenceRule(value: RecurrenceRule, path: string): void {
  if (value["@type"] !== "RecurrenceRule") fail(path, "must have @type RecurrenceRule");
  if (!RECURRENCE_FREQUENCY.has(value.frequency)) fail(`${path}.frequency`, "must be a valid frequency");
  assertUnsignedInt(value.interval, `${path}.interval`);
  assertUnsignedInt(value.count, `${path}.count`);
  if (value.rscale !== undefined && value.rscale !== "gregorian") {
    fail(`${path}.rscale`, "only gregorian is supported");
  }
  if (value.skip !== undefined && !SKIP.has(value.skip)) fail(`${path}.skip`, "must be omit, backward, or forward");
  if (value.firstDayOfWeek !== undefined && !DAY_OF_WEEK.has(value.firstDayOfWeek)) {
    fail(`${path}.firstDayOfWeek`, "must be a valid day of week");
  }
  if (value.byDay) {
    for (let i = 0; i < value.byDay.length; i += 1) {
      const entry = value.byDay[i];
      if (!entry) continue;
      validateNDay(entry, `${path}.byDay[${i}]`);
    }
  }
  if (value.byMonthDay) {
    for (let i = 0; i < value.byMonthDay.length; i += 1) {
      const entry = value.byMonthDay[i];
      if (typeof entry !== "number" || !Number.isInteger(entry) || entry === 0 || entry < -31 || entry > 31) {
        fail(`${path}.byMonthDay[${i}]`, "must be an integer between -31 and 31, excluding 0");
      }
    }
  }
  if (value.byMonth) {
    for (let i = 0; i < value.byMonth.length; i += 1) {
      const entry = value.byMonth[i];
      if (typeof entry !== "string") fail(`${path}.byMonth[${i}]`, "must be a string month");
      const numeric = Number.parseInt(entry, 10);
      if (!Number.isInteger(numeric) || numeric < 1 || numeric > 12) {
        fail(`${path}.byMonth[${i}]`, "must be a month number between 1 and 12");
      }
    }
  }
  if (value.byYearDay) {
    for (let i = 0; i < value.byYearDay.length; i += 1) {
      const entry = value.byYearDay[i];
      if (typeof entry !== "number" || !Number.isInteger(entry) || entry === 0 || entry < -366 || entry > 366) {
        fail(`${path}.byYearDay[${i}]`, "must be an integer between -366 and 366, excluding 0");
      }
    }
  }
  if (value.byWeekNo) {
    for (let i = 0; i < value.byWeekNo.length; i += 1) {
      const entry = value.byWeekNo[i];
      if (typeof entry !== "number" || !Number.isInteger(entry) || entry === 0 || entry < -53 || entry > 53) {
        fail(`${path}.byWeekNo[${i}]`, "must be an integer between -53 and 53, excluding 0");
      }
    }
  }
  if (value.byHour) {
    for (let i = 0; i < value.byHour.length; i += 1) {
      const entry = value.byHour[i];
      if (typeof entry !== "number" || !Number.isInteger(entry) || entry < 0 || entry > 23) {
        fail(`${path}.byHour[${i}]`, "must be an integer between 0 and 23");
      }
    }
  }
  if (value.byMinute) {
    for (let i = 0; i < value.byMinute.length; i += 1) {
      const entry = value.byMinute[i];
      if (typeof entry !== "number" || !Number.isInteger(entry) || entry < 0 || entry > 59) {
        fail(`${path}.byMinute[${i}]`, "must be an integer between 0 and 59");
      }
    }
  }
  if (value.bySecond) {
    for (let i = 0; i < value.bySecond.length; i += 1) {
      const entry = value.bySecond[i];
      if (typeof entry !== "number" || !Number.isInteger(entry) || entry < 0 || entry > 59) {
        fail(`${path}.bySecond[${i}]`, "must be an integer between 0 and 59");
      }
    }
  }
  if (value.bySetPosition) {
    for (let i = 0; i < value.bySetPosition.length; i += 1) {
      const entry = value.bySetPosition[i];
      if (typeof entry !== "number" || !Number.isInteger(entry) || entry === 0) {
        fail(`${path}.bySetPosition[${i}]`, "must be a non-zero integer");
      }
    }
  }
  assertLocalDateTime(value.until, `${path}.until`);
}

function validateAlert(value: Alert, path: string): void {
  if (value["@type"] !== "Alert") fail(path, "must have @type Alert");
  if (!value.trigger) fail(`${path}.trigger`, "is required");
  if (value.trigger["@type"] === "OffsetTrigger") {
    const offset = value.trigger.offset;
    if (typeof offset !== "string") {
      fail(`${path}.trigger.offset`, "must be a duration string");
    }
    assertSignedDuration(offset, `${path}.trigger.offset`);
  } else if (value.trigger["@type"] === "AbsoluteTrigger") {
    const when = value.trigger.when;
    if (typeof when !== "string") {
      fail(`${path}.trigger.when`, "must be a UTCDateTime string");
    }
    assertUtcDateTime(when, `${path}.trigger.when`);
  }
  assertUtcDateTime(value.acknowledged, `${path}.acknowledged`);
  assertString(value.action, `${path}.action`);
  if (value.relatedTo) {
    if (typeof value.relatedTo !== "object" || value.relatedTo === null || Array.isArray(value.relatedTo)) {
      fail(`${path}.relatedTo`, "must be an object");
    }
    for (const [key, entry] of Object.entries(value.relatedTo)) {
      if (!entry || typeof entry !== "object") {
        fail(`${path}.relatedTo.${key}`, "must be a relation object");
      }
      validateRelation(entry, `${path}.relatedTo.${key}`);
    }
  }
}

function validateRelation(value: Relation, path: string): void {
  if (value["@type"] !== "Relation") fail(path, "must have @type Relation");
  if (value.relation) assertBooleanMap(value.relation, `${path}.relation`);
}

function validateLink(value: Link, path: string): void {
  if (value["@type"] !== "Link") fail(path, "must have @type Link");
  assertString(value.href, `${path}.href`);
  if (!value.href) fail(`${path}.href`, "is required");
  assertContentId(value.cid, `${path}.cid`);
  assertMediaType(value.contentType, `${path}.contentType`);
  assertUnsignedInt(value.size, `${path}.size`);
  assertString(value.rel, `${path}.rel`);
  assertString(value.display, `${path}.display`);
  assertString(value.title, `${path}.title`);
}

function validateLocation(value: Location, path: string): void {
  if (value["@type"] !== "Location") fail(path, "must have @type Location");
  assertId(value.relativeTo, `${path}.relativeTo`);
  assertString(value.name, `${path}.name`);
  assertString(value.description, `${path}.description`);
  if (value.locationTypes) assertBooleanMap(value.locationTypes, `${path}.locationTypes`);
  assertString(value.relativeTo, `${path}.relativeTo`);
  assertTimeZone(value.timeZone, `${path}.timeZone`);
  assertString(value.coordinates, `${path}.coordinates`);
  if (value.links) {
    if (typeof value.links !== "object" || value.links === null || Array.isArray(value.links)) {
      fail(`${path}.links`, "must be an object");
    }
    for (const [key, entry] of Object.entries(value.links)) {
      assertId(key, `${path}.links.${key}`);
      if (!entry || typeof entry !== "object") {
        fail(`${path}.links.${key}`, "must be a link object");
      }
      validateLink(entry, `${path}.links.${key}`);
    }
  }
}

function validateVirtualLocation(value: VirtualLocation, path: string): void {
  if (value["@type"] !== "VirtualLocation") fail(path, "must have @type VirtualLocation");
  assertString(value.name, `${path}.name`);
  assertString(value.description, `${path}.description`);
  assertString(value.uri, `${path}.uri`);
  if (!value.uri) fail(`${path}.uri`, "is required");
  if (value.features) assertBooleanMap(value.features, `${path}.features`);
}

function validateTimeZoneRule(value: TimeZoneRule, path: string): void {
  if (value["@type"] !== "TimeZoneRule") fail(path, "must have @type TimeZoneRule");
  assertLocalDateTime(value.start, `${path}.start`);
  if (!value.start) fail(`${path}.start`, "is required");
  assertString(value.offsetFrom, `${path}.offsetFrom`);
  if (!value.offsetFrom) fail(`${path}.offsetFrom`, "is required");
  assertString(value.offsetTo, `${path}.offsetTo`);
  if (!value.offsetTo) fail(`${path}.offsetTo`, "is required");
  if (value.recurrenceRules) {
    value.recurrenceRules.forEach((rule, index) => validateRecurrenceRule(rule, `${path}.recurrenceRules[${index}]`));
  }
  if (value.recurrenceOverrides) {
    if (typeof value.recurrenceOverrides !== "object" || value.recurrenceOverrides === null || Array.isArray(value.recurrenceOverrides)) {
      fail(`${path}.recurrenceOverrides`, "must be an object");
    }
    for (const [key, entry] of Object.entries(value.recurrenceOverrides)) {
      assertLocalDateTime(key, `${path}.recurrenceOverrides.${key}`);
      assertPatchObject(entry, `${path}.recurrenceOverrides.${key}`);
    }
  }
  if (value.names) assertBooleanMap(value.names, `${path}.names`);
  if (value.comments) {
    value.comments.forEach((entry, index) => assertString(entry, `${path}.comments[${index}]`));
  }
}

function validateTimeZoneObject(value: TimeZone, path: string): void {
  if (value["@type"] !== "TimeZone") fail(path, "must have @type TimeZone");
  assertTimeZone(value.tzId, `${path}.tzId`);
  if (!value.tzId) fail(`${path}.tzId`, "is required");
  assertUtcDateTime(value.updated, `${path}.updated`);
  assertString(value.url, `${path}.url`);
  assertUtcDateTime(value.validUntil, `${path}.validUntil`);
  if (value.aliases) assertBooleanMap(value.aliases, `${path}.aliases`);
  if (value.standard) {
    value.standard.forEach((rule, index) => validateTimeZoneRule(rule, `${path}.standard[${index}]`));
  }
  if (value.daylight) {
    value.daylight.forEach((rule, index) => validateTimeZoneRule(rule, `${path}.daylight[${index}]`));
  }
}

function validateParticipant(value: Participant, path: string): void {
  if (value["@type"] !== "Participant") fail(path, "must have @type Participant");
  assertString(value.name, `${path}.name`);
  assertString(value.email, `${path}.email`);
  assertString(value.description, `${path}.description`);
  if (value.sendTo) {
    if (typeof value.sendTo !== "object" || value.sendTo === null || Array.isArray(value.sendTo)) {
      fail(`${path}.sendTo`, "must be an object");
    }
    for (const [key, entry] of Object.entries(value.sendTo)) {
      assertString(entry, `${path}.sendTo.${key}`);
    }
  }
  if (value.roles) assertBooleanMap(value.roles, `${path}.roles`);
  assertId(value.locationId, `${path}.locationId`);
  assertString(value.language, `${path}.language`);
  assertString(value.participationStatus, `${path}.participationStatus`);
  assertString(value.participationComment, `${path}.participationComment`);
  assertBoolean(value.expectReply, `${path}.expectReply`);
  assertString(value.scheduleAgent, `${path}.scheduleAgent`);
  assertBoolean(value.scheduleForceSend, `${path}.scheduleForceSend`);
  assertUnsignedInt(value.scheduleSequence, `${path}.scheduleSequence`);
  if (value.scheduleStatus) {
    value.scheduleStatus.forEach((entry, index) => assertString(entry, `${path}.scheduleStatus[${index}]`));
  }
  assertUtcDateTime(value.scheduleUpdated, `${path}.scheduleUpdated`);
  assertString(value.sentBy, `${path}.sentBy`);
  assertId(value.invitedBy, `${path}.invitedBy`);
  if (value.delegatedTo) assertIdBooleanMap(value.delegatedTo, `${path}.delegatedTo`);
  if (value.delegatedFrom) assertIdBooleanMap(value.delegatedFrom, `${path}.delegatedFrom`);
  if (value.memberOf) assertIdBooleanMap(value.memberOf, `${path}.memberOf`);
  if (value.links) {
    if (typeof value.links !== "object" || value.links === null || Array.isArray(value.links)) {
      fail(`${path}.links`, "must be an object");
    }
    for (const [key, entry] of Object.entries(value.links)) {
      assertId(key, `${path}.links.${key}`);
      if (!entry || typeof entry !== "object") {
        fail(`${path}.links.${key}`, "must be a link object");
      }
      validateLink(entry, `${path}.links.${key}`);
    }
  }
  assertString(value.progress, `${path}.progress`);
  assertUtcDateTime(value.progressUpdated, `${path}.progressUpdated`);
  assertUnsignedInt(value.percentComplete, `${path}.percentComplete`);
}

function validateCommon(value: JSCalendarObject, path: string): void {
  assertNonEmptyString(value.uid, `${path}.uid`);
  if (!value.uid) fail(`${path}.uid`, "is required");
  assertUtcDateTime(value.updated, `${path}.updated`);
  assertUtcDateTime(value.created, `${path}.created`);
  assertUnsignedInt(value.sequence, `${path}.sequence`);
  assertString(value.method, `${path}.method`);
  if (value.method && value.method !== value.method.toLowerCase()) {
    fail(`${path}.method`, "must be lowercase");
  }
  assertString(value.title, `${path}.title`);
  assertString(value.description, `${path}.description`);
  assertTextContentType(value.descriptionContentType, `${path}.descriptionContentType`);
  assertBoolean(value.showWithoutTime, `${path}.showWithoutTime`);
  if (value.relatedTo) {
    if (typeof value.relatedTo !== "object" || value.relatedTo === null || Array.isArray(value.relatedTo)) {
      fail(`${path}.relatedTo`, "must be an object");
    }
    for (const [key, entry] of Object.entries(value.relatedTo)) {
      assertNonEmptyString(key, `${path}.relatedTo.${key}`);
      if (!entry || typeof entry !== "object") {
        fail(`${path}.relatedTo.${key}`, "must be a relation object");
      }
      validateRelation(entry, `${path}.relatedTo.${key}`);
    }
  }
  if (value.keywords) assertBooleanMap(value.keywords, `${path}.keywords`);
  if (value.categories) assertBooleanMap(value.categories, `${path}.categories`);
  assertString(value.color, `${path}.color`);
  assertLocalDateTime(value.recurrenceId, `${path}.recurrenceId`);
  assertTimeZone(value.recurrenceIdTimeZone, `${path}.recurrenceIdTimeZone`);
  if (value.recurrenceRules) {
    value.recurrenceRules.forEach((rule, index) => validateRecurrenceRule(rule, `${path}.recurrenceRules[${index}]`));
  }
  if (value.excludedRecurrenceRules) {
    value.excludedRecurrenceRules.forEach((rule, index) =>
      validateRecurrenceRule(rule, `${path}.excludedRecurrenceRules[${index}]`),
    );
  }
  if (value.recurrenceOverrides) {
    if (typeof value.recurrenceOverrides !== "object" || value.recurrenceOverrides === null || Array.isArray(value.recurrenceOverrides)) {
      fail(`${path}.recurrenceOverrides`, "must be an object");
    }
    for (const [key, entry] of Object.entries(value.recurrenceOverrides)) {
      assertLocalDateTime(key, `${path}.recurrenceOverrides.${key}`);
      assertPatchObject(entry, `${path}.recurrenceOverrides.${key}`);
    }
  }
  assertBoolean(value.excluded, `${path}.excluded`);
  assertInteger(value.priority, `${path}.priority`);
  assertString(value.freeBusyStatus, `${path}.freeBusyStatus`);
  assertString(value.privacy, `${path}.privacy`);
  if (value.replyTo) {
    if (typeof value.replyTo !== "object" || value.replyTo === null || Array.isArray(value.replyTo)) {
      fail(`${path}.replyTo`, "must be an object");
    }
    for (const [key, entry] of Object.entries(value.replyTo)) {
      assertString(entry, `${path}.replyTo.${key}`);
    }
  }
  assertString(value.sentBy, `${path}.sentBy`);
  if (value.locations) {
    if (typeof value.locations !== "object" || value.locations === null || Array.isArray(value.locations)) {
      fail(`${path}.locations`, "must be an object");
    }
    for (const [key, entry] of Object.entries(value.locations)) {
      assertId(key, `${path}.locations.${key}`);
      if (!entry || typeof entry !== "object") {
        fail(`${path}.locations.${key}`, "must be a location object");
      }
      validateLocation(entry, `${path}.locations.${key}`);
    }
  }
  if (value.virtualLocations) {
    if (typeof value.virtualLocations !== "object" || value.virtualLocations === null || Array.isArray(value.virtualLocations)) {
      fail(`${path}.virtualLocations`, "must be an object");
    }
    for (const [key, entry] of Object.entries(value.virtualLocations)) {
      assertId(key, `${path}.virtualLocations.${key}`);
      if (!entry || typeof entry !== "object") {
        fail(`${path}.virtualLocations.${key}`, "must be a virtual location object");
      }
      validateVirtualLocation(entry, `${path}.virtualLocations.${key}`);
    }
  }
  if (value.links) {
    if (typeof value.links !== "object" || value.links === null || Array.isArray(value.links)) {
      fail(`${path}.links`, "must be an object");
    }
    for (const [key, entry] of Object.entries(value.links)) {
      assertId(key, `${path}.links.${key}`);
      if (!entry || typeof entry !== "object") {
        fail(`${path}.links.${key}`, "must be a link object");
      }
      validateLink(entry, `${path}.links.${key}`);
    }
  }
  if (value.participants) {
    if (typeof value.participants !== "object" || value.participants === null || Array.isArray(value.participants)) {
      fail(`${path}.participants`, "must be an object");
    }
    for (const [key, entry] of Object.entries(value.participants)) {
      assertId(key, `${path}.participants.${key}`);
      if (!entry || typeof entry !== "object") {
        fail(`${path}.participants.${key}`, "must be a participant object");
      }
      validateParticipant(entry, `${path}.participants.${key}`);
    }
  }
  assertString(value.requestStatus, `${path}.requestStatus`);
  assertBoolean(value.useDefaultAlerts, `${path}.useDefaultAlerts`);
  if (value.alerts) {
    if (typeof value.alerts !== "object" || value.alerts === null || Array.isArray(value.alerts)) {
      fail(`${path}.alerts`, "must be an object");
    }
    for (const [key, entry] of Object.entries(value.alerts)) {
      assertId(key, `${path}.alerts.${key}`);
      if (!entry || typeof entry !== "object") {
        fail(`${path}.alerts.${key}`, "must be an alert object");
      }
      validateAlert(entry, `${path}.alerts.${key}`);
    }
  }
  if (value.localizations) {
    if (!isRecord(value.localizations)) fail(`${path}.localizations`, "must be an object");
    for (const [key, entry] of Object.entries(value.localizations)) {
      assertPatchObject(entry, `${path}.localizations.${key}`);
    }
  }
  assertTimeZone(value.timeZone, `${path}.timeZone`);
  if (value.timeZones) {
    const timeZones = value.timeZones;
    if (typeof timeZones !== "object" || timeZones === null || Array.isArray(timeZones)) {
      fail(`${path}.timeZones`, "must be an object");
    }
    for (const [key] of Object.entries(timeZones)) {
      assertTimeZone(key, `${path}.timeZones.${key}`);
    }
    for (const [key, entry] of Object.entries(timeZones)) {
      if (!entry || typeof entry !== "object") {
        fail(`${path}.timeZones.${key}`, "must be a time zone object");
      }
      validateTimeZoneObject(entry, `${path}.timeZones.${key}`);
    }
  }
}

function validateEvent(value: Event, path: string): void {
  if (value["@type"] !== "Event") fail(path, "must have @type Event");
  validateCommon(value, path);
  assertLocalDateTime(value.start, `${path}.start`);
  if (!value.start) fail(`${path}.start`, "is required");
  assertDuration(value.duration, `${path}.duration`);
  assertString(value.status, `${path}.status`);
}

function validateTask(value: Task, path: string): void {
  if (value["@type"] !== "Task") fail(path, "must have @type Task");
  validateCommon(value, path);
  assertLocalDateTime(value.start, `${path}.start`);
  assertLocalDateTime(value.due, `${path}.due`);
  assertDuration(value.estimatedDuration, `${path}.estimatedDuration`);
  assertUnsignedInt(value.percentComplete, `${path}.percentComplete`);
  assertString(value.progress, `${path}.progress`);
  assertUtcDateTime(value.progressUpdated, `${path}.progressUpdated`);
}

function validateGroup(value: Group, path: string): void {
  if (value["@type"] !== "Group") fail(path, "must have @type Group");
  validateCommon(value, path);
  if (!Array.isArray(value.entries)) fail(`${path}.entries`, "must be an array");
  value.entries.forEach((entry, index) => validateJsCalendarObject(entry, `${path}.entries[${index}]`));
  assertString(value.source, `${path}.source`);
}

export function validateJsCalendarObject(value: JSCalendarObject, path = "object"): void {
  if (!value || typeof value !== "object") fail(path, "must be an object");
  if (value["@type"] === "Event") return validateEvent(value, path);
  if (value["@type"] === "Task") return validateTask(value, path);
  if (value["@type"] === "Group") return validateGroup(value, path);
  fail(`${path}["@type"]`, "must be Event, Task, or Group");
}
