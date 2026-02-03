import type { JsonValue, PatchLike } from "../types.js";
import { TimeZones } from "../timezones.js";
import { fail } from "./error.js";
import { CHARSET_KEY, DATE_TIME, DURATION, ID_PATTERN, UTF8, Z_SUFFIX } from "./constants.js";
import { isBooleanValue, isNumberValue, isObjectValue, isStringValue } from "../utils.js";

const TYPEOF_UNDEFINED = "undefined";

/**
 * Get the UTF-8 byte length of a string.
 * @param value Input string.
 * @return Byte length.
 */
export function utf8Length(value: string): number {
  if (typeof TextEncoder !== TYPEOF_UNDEFINED) {
    return new TextEncoder().encode(value).length;
  }
  return value.length;
}

/**
 * Check whether a value is a plain record.
 * @param value Input value.
 * @return True if the value is a record.
 */
export function isRecord(value: object | null | undefined): value is Record<string, JsonValue> {
  return !!value && isObjectValue(value) && !Array.isArray(value);
}

/**
 * Assert a value is a string when defined.
 * @param value Value to check.
 * @param path Validation path.
 * @return Nothing.
 */
export function assertString(value: string | null | undefined, path: string): void {
  if (value === undefined || value === null) return;
  if (!isStringValue(value)) fail(path, "must be a string");
}

/**
 * Assert a value is a non-empty string when defined.
 * @param value Value to check.
 * @param path Validation path.
 * @return Nothing.
 */
export function assertNonEmptyString(value: string | undefined, path: string): void {
  if (value === undefined) return;
  if (!isStringValue(value)) fail(path, "must be a string");
  if (value.length === 0) fail(path, "must not be empty");
}

/**
 * Assert a value is a valid Id when defined.
 * @param value Value to check.
 * @param path Validation path.
 * @return Nothing.
 */
export function assertId(value: string | undefined, path: string): void {
  if (value === undefined) return;
  if (!isStringValue(value)) fail(path, "must be an Id");
  const length = utf8Length(value);
  if (length < 1 || length > 255) fail(path, "must be between 1 and 255 octets");
  if (!ID_PATTERN.test(value)) fail(path, "must use base64url characters");
}

/**
 * Assert a value is boolean when defined.
 * @param value Value to check.
 * @param path Validation path.
 * @return Nothing.
 */
export function assertBoolean(value: boolean | null | undefined, path: string): void {
  if (value === undefined || value === null) return;
  if (!isBooleanValue(value)) fail(path, "must be a boolean");
}

/**
 * Assert a value is an integer when defined.
 * @param value Value to check.
 * @param path Validation path.
 * @return Nothing.
 */
export function assertInteger(value: number | null | undefined, path: string): void {
  if (value === undefined || value === null) return;
  if (!isNumberValue(value) || !Number.isInteger(value)) fail(path, "must be an integer");
}

/**
 * Assert a value is a non-negative integer when defined.
 * @param value Value to check.
 * @param path Validation path.
 * @return Nothing.
 */
export function assertUnsignedInt(value: number | null | undefined, path: string): void {
  if (value === undefined || value === null) return;
  if (!isNumberValue(value) || !Number.isInteger(value) || value < 0) {
    fail(path, "must be a non-negative integer");
  }
}

/**
 * Assert a date-time string matches the expected format.
 * @param value Date-time string.
 * @param path Validation path.
 * @param requireZ Whether a Z suffix is required.
 * @return Nothing.
 */
export function assertDateTime(value: string | undefined, path: string, requireZ: boolean): void {
  if (value === undefined) return;
  if (!isStringValue(value)) fail(path, "must be a date-time string");
  const match = value.match(DATE_TIME);
  if (!match) {
    fail(path, requireZ ? "must be a UTCDateTime (YYYY-MM-DDTHH:mm:ssZ)" : "must be a LocalDateTime (YYYY-MM-DDTHH:mm:ss)");
  }
  const [, year, month, day, hour, minute, second, fraction, zFlag] = match;
  if (requireZ && zFlag !== Z_SUFFIX) fail(path, "must use Z suffix");
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

/**
 * Assert local date time when provided.
 * @param value LocalDateTime string.
 * @param path Validation path.
 * @return Nothing.
 */
export function assertLocalDateTime(value: string | undefined, path: string): void {
  return assertDateTime(value, path, false);
}

/**
 * Assert utc date time when provided.
 * @param value UTCDateTime string.
 * @param path Validation path.
 * @return Nothing.
 */
export function assertUtcDateTime(value: string | undefined, path: string): void {
  return assertDateTime(value, path, true);
}

/**
 * Assert duration like when provided.
 * @param value Duration string.
 * @param path Validation path.
 * @param signed Whether negative values are allowed.
 * @return Nothing.
 */
export function assertDurationLike(value: string | undefined, path: string, signed: boolean): void {
  if (value === undefined) return;
  if (!isStringValue(value)) fail(path, "must be a duration string");
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

/**
 * Assert duration when provided.
 * @param value Duration string.
 * @param path Validation path.
 * @return Nothing.
 */
export function assertDuration(value: string | undefined, path: string): void {
  return assertDurationLike(value, path, false);
}

/**
 * Assert signed duration when provided.
 * @param value Duration string.
 * @param path Validation path.
 * @return Nothing.
 */
export function assertSignedDuration(value: string | undefined, path: string): void {
  return assertDurationLike(value, path, true);
}

/**
 * Assert boolean map when provided.
 * @param value Boolean map object.
 * @param path Validation path.
 * @return Nothing.
 */
export function assertBooleanMap(value: object | undefined, path: string): void {
  if (value === undefined) return;
  if (!isRecord(value)) fail(path, "must be a boolean map object");
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== true) fail(`${path}.${key}`, "must be true");
  }
}

/**
 * Assert ID boolean map when provided.
 * @param value Boolean map object keyed by Ids.
 * @param path Validation path.
 * @return Nothing.
 */
export function assertIdBooleanMap(value: object | undefined, path: string): void {
  if (value === undefined) return;
  if (!isRecord(value)) fail(path, "must be a boolean map object");
  for (const [key, entry] of Object.entries(value)) {
    assertId(key, `${path}.${key}`);
    if (entry !== true) fail(`${path}.${key}`, "must be true");
  }
}

/**
 * Assert media type when provided.
 * @param value Media type string.
 * @param path Validation path.
 * @return Nothing.
 */
export function assertMediaType(value: string | undefined, path: string): void {
  if (value === undefined) return;
  if (!isStringValue(value)) fail(path, "must be a media type string");
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
    if (key === CHARSET_KEY && valuePart !== UTF8) {
      fail(path, "charset parameter must be utf-8");
    }
  }
}

/**
 * Assert text content type when provided.
 * @param value Media type string.
 * @param path Validation path.
 * @return Nothing.
 */
export function assertTextContentType(value: string | undefined, path: string): void {
  if (value === undefined) return;
  if (!isStringValue(value)) fail(path, "must be a media type string");
  const [typePart] = value.split(";");
  const mediaType = (typePart ?? "").trim();
  if (!mediaType.startsWith("text/")) fail(path, "must be a text/* media type");
  assertMediaType(value, path);
}

/**
 * Assert content ID when provided.
 * @param value Content-ID string.
 * @param path Validation path.
 * @return Nothing.
 */
export function assertContentId(value: string | undefined, path: string): void {
  if (value === undefined) return;
  if (!isStringValue(value)) fail(path, "must be a content-id");
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

/**
 * Assert time zone when provided.
 * @param value Time zone ID.
 * @param path Validation path.
 * @return Nothing.
 */
export function assertTimeZone(value: string | null | undefined, path: string): void {
  if (value === undefined || value === null) return;
  if (!isStringValue(value)) fail(path, "must be a time zone ID");
  for (const tz of TimeZones) {
    if (tz === value) return;
  }
  fail(path, "must be a supported time zone ID");
}

/**
 * Assert json value when provided.
 * @param value JSON value.
 * @param path Validation path.
 * @return Nothing.
 */
export function assertJsonValue(value: JsonValue | object | null | undefined, path: string): void {
  if (value === undefined) fail(path, "must be a JSON value");
  if (value === null) return;
  if (isStringValue(value) || isNumberValue(value) || isBooleanValue(value)) return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertJsonValue(entry, `${path}[${index}]`));
    return;
  }
  if (isObjectValue(value)) {
    if (!isRecord(value)) fail(path, "must be a JSON object");
    for (const [key, entry] of Object.entries(value)) {
      assertJsonValue(entry, `${path}.${key}`);
    }
    return;
  }
  fail(path, "must be a JSON value");
}

/**
 * Assert patch object when provided.
 * @param value PatchObject.
 * @param path Validation path.
 * @return Nothing.
 */
export function assertPatchObject(value: PatchLike | undefined, path: string): void {
  if (value === undefined) return;
  if (!isRecord(value)) fail(path, "must be a PatchObject");
  for (const [key, entry] of Object.entries(value)) {
    if (entry === null) continue;
    assertJsonValue(entry, `${path}.${key}`);
  }
}
