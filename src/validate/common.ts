import { z } from "zod";
import type { ZodIssue } from "zod";
import { TimeZones } from "../timezones.js";
import {
    DATE_TIME,
    DAY_OF_WEEK,
    DURATION,
    ID_PATTERN,
    PARTICIPANT_ROLE,
    RECURRENCE_FREQUENCY,
    SKIP,
    VENDOR_SPECIFIC_VALUE,
    Z_SUFFIX,
} from "./constants.js";
import { ValidationError } from "./error.js";
const CHARSET_KEY = "charset";
const TYPE_TEXT_PREFIX = "text/";
const UTF8 = "utf-8";
const TYPE_STRING = "string";
const DEFAULT_VALIDATION_PATH = "object";

/**
 * Check whether a value is a string.
 * @param value Input value.
 * @return True when the value is a string.
 */
function isStringValue(value: string): value is string {
    return typeof value === TYPE_STRING;
}

/**
 * Convert Zod issue paths to the library's validation path format.
 * @param root Root path supplied by the caller.
 * @param path Zod issue path.
 * @return Formatted validation path.
 */
function formatIssuePath(root: string, path: readonly PropertyKey[]): string {
    let current = root;
    for (const segment of path) {
        if (typeof segment === "number") {
            current = `${current}[${segment}]`;
        } else {
            current = `${current}.${String(segment)}`;
        }
    }
    return current;
}

/**
 * Throw the first Zod issue as a ValidationError.
 * @param issues Zod issues.
 * @param root Root validation path.
 * @return Never returns.
 */
function throwFirstIssue(issues: readonly ZodIssue[], root: string): never {
    const issue = issues[0];
    if (!issue) throw new ValidationError(root, "is invalid");
    throw new ValidationError(formatIssuePath(root, issue.path), issue.message);
}

/**
 * Add a custom Zod issue.
 * @param ctx Zod refinement context.
 * @param path Relative issue path.
 * @param message Error message.
 * @return Nothing.
 */
export function addIssue(
    ctx: z.RefinementCtx,
    path: Array<string | number>,
    message: string,
): void {
    ctx.addIssue({ code: "custom", path, message });
}

/**
 * Check object keys against an allow-list.
 * @param value Object to inspect.
 * @param ctx Zod refinement context.
 * @return Nothing.
 */
function checkKnownProperties(
    value: object,
    properties: readonly string[],
    ctx: z.RefinementCtx,
): void {
    for (const key of Object.keys(value)) {
        if (!properties.includes(key)) {
            addIssue(ctx, [key], "is not a known JSCalendar property");
        }
    }
}

/**
 * Create an object schema with explicit allowed properties.
 * @param shape Zod object shape.
 * @return Object schema.
 */
export function objectSchema(shape: z.ZodRawShape) {
    const properties = Object.keys(shape);
    return z
        .object(shape)
        .catchall(z.json())
        .superRefine((value, ctx) => {
            checkKnownProperties(value, properties, ctx);
        });
}

/**
 * Create a schema for optional string-like fields.
 * @return Zod schema.
 */
export function optionalString() {
    return z.string().nullish();
}

/**
 * Create a schema for optional boolean fields.
 * @return Zod schema.
 */
export function optionalBoolean() {
    return z.boolean().nullish();
}

/**
 * Create a schema for optional integer fields.
 * @return Zod schema.
 */
export function optionalInteger() {
    return z.number().int().nullish();
}

/**
 * Create a schema for optional unsigned integer fields.
 * @return Zod schema.
 */
export function optionalUnsignedInteger() {
    return z.number().int().nonnegative().nullish();
}

/**
 * Create a schema for optional Id fields.
 * @return Zod schema.
 */
export function optionalId() {
    return z
        .string()
        .optional()
        .superRefine((value, ctx) => {
            if (value === undefined) return;
            checkId(value, ctx, []);
        });
}

/**
 * Validate an Id value.
 * @param value Id value.
 * @param ctx Zod refinement context.
 * @param path Relative issue path.
 * @return Nothing.
 */
function checkId(
    value: string,
    ctx: z.RefinementCtx,
    path: Array<string | number>,
): void {
    if (!isStringValue(value)) {
        addIssue(ctx, path, "must be an Id");
        return;
    }
    const length = utf8Length(value);
    if (length < 1 || length > 255) {
        addIssue(ctx, path, "must be between 1 and 255 octets");
        return;
    }
    if (!ID_PATTERN.test(value)) {
        addIssue(ctx, path, "must use base64url characters");
    }
}

/**
 * Check whether a value is a supported time zone ID.
 * @param value Time zone value.
 * @return True when supported.
 */
export function isSupportedTimeZone(value: string): boolean {
    for (const timeZone of TimeZones) {
        if (timeZone === value) return true;
    }
    return false;
}

/**
 * Check recurrence frequency values.
 * @param value Input value.
 * @return True when supported.
 */
export function isRecurrenceFrequency(value: string): boolean {
    for (const frequency of RECURRENCE_FREQUENCY) {
        if (frequency === value) return true;
    }
    return false;
}

/**
 * Check recurrence skip values.
 * @param value Input value.
 * @return True when supported.
 */
export function isSkipValue(value: string): boolean {
    for (const skip of SKIP) {
        if (skip === value) return true;
    }
    return false;
}

/**
 * Check day-of-week values.
 * @param value Input value.
 * @return True when supported.
 */
export function isDayOfWeek(value: string): boolean {
    for (const day of DAY_OF_WEEK) {
        if (day === value) return true;
    }
    return false;
}

/**
 * Check participant role values.
 * @param value Input value.
 * @return True when supported.
 */
export function isParticipantRole(value: string): boolean {
    for (const role of PARTICIPANT_ROLE) {
        if (role === value) return true;
    }
    return false;
}

/**
 * Check vendor-specific extension values.
 * @param value Input value.
 * @return True when the value has a vendor-specific prefix.
 */
export function isVendorSpecificValue(value: string): boolean {
    return VENDOR_SPECIFIC_VALUE.test(value);
}

/**
 * Get UTF-8 byte length.
 * @param value Input string.
 * @return Byte length.
 */
function utf8Length(value: string): number {
    return new TextEncoder().encode(value).length;
}

/**
 * Create a date-time schema.
 * @param requireZ Whether a Z suffix is required.
 * @return Zod schema.
 */
export function optionalDateTime(requireZ: boolean) {
    return dateTimeSchema(requireZ).optional();
}

/**
 * Create a date-time schema.
 * @param requireZ Whether a Z suffix is required.
 * @return Zod schema.
 */
export function dateTimeSchema(requireZ: boolean) {
    return z
        .string({
            error: requireZ
                ? "must be a UTCDateTime (YYYY-MM-DDTHH:mm:ssZ)"
                : "must be a LocalDateTime (YYYY-MM-DDTHH:mm:ss)",
        })
        .superRefine((value, ctx) => {
            checkDateTimeString(value, requireZ, ctx, []);
        });
}

/**
 * Validate a date-time string.
 * @param value Date-time string.
 * @param requireZ Whether a Z suffix is required.
 * @param ctx Zod refinement context.
 * @param path Relative issue path.
 * @return Nothing.
 */
export function checkDateTimeString(
    value: string,
    requireZ: boolean,
    ctx: z.RefinementCtx,
    path: Array<string | number>,
): void {
    const match = value.match(DATE_TIME);
    if (!match) {
        addIssue(
            ctx,
            path,
            requireZ
                ? "must be a UTCDateTime (YYYY-MM-DDTHH:mm:ssZ)"
                : "must be a LocalDateTime (YYYY-MM-DDTHH:mm:ss)",
        );
        return;
    }
    const [, , month, day, hour, minute, second, fraction, zFlag] = match;
    if (requireZ && zFlag !== Z_SUFFIX) {
        addIssue(ctx, path, "must use Z suffix");
        return;
    }
    if (!requireZ && zFlag) {
        addIssue(ctx, path, "must not include time zone offset");
        return;
    }
    checkDateParts(month, day, hour, minute, second, ctx, path);
    if (fraction !== undefined) checkFraction(fraction, ctx, path);
}

/**
 * Validate date-time numeric fields.
 * @param month Month string.
 * @param day Day string.
 * @param hour Hour string.
 * @param minute Minute string.
 * @param second Second string.
 * @param ctx Zod refinement context.
 * @param path Relative issue path.
 * @return Nothing.
 */
function checkDateParts(
    month: string | undefined,
    day: string | undefined,
    hour: string | undefined,
    minute: string | undefined,
    second: string | undefined,
    ctx: z.RefinementCtx,
    path: Array<string | number>,
): void {
    const monthNum = Number.parseInt(month ?? "0", 10);
    const dayNum = Number.parseInt(day ?? "0", 10);
    const hourNum = Number.parseInt(hour ?? "0", 10);
    const minuteNum = Number.parseInt(minute ?? "0", 10);
    const secondNum = Number.parseInt(second ?? "0", 10);
    if (monthNum < 1 || monthNum > 12)
        addIssue(ctx, path, "month must be 01-12");
    if (dayNum < 1 || dayNum > 31) addIssue(ctx, path, "day must be 01-31");
    if (hourNum < 0 || hourNum > 23) addIssue(ctx, path, "hour must be 00-23");
    if (minuteNum < 0 || minuteNum > 59)
        addIssue(ctx, path, "minute must be 00-59");
    if (secondNum < 0 || secondNum > 59)
        addIssue(ctx, path, "second must be 00-59");
}

/**
 * Validate fractional seconds.
 * @param fraction Fraction string.
 * @param ctx Zod refinement context.
 * @param path Relative issue path.
 * @return Nothing.
 */
function checkFraction(
    fraction: string,
    ctx: z.RefinementCtx,
    path: Array<string | number>,
): void {
    if (fraction.length > 9) {
        addIssue(ctx, path, "fractional seconds must be 1-9 digits");
        return;
    }
    if (/^0+$/.test(fraction)) {
        addIssue(ctx, path, "fractional seconds must be non-zero");
        return;
    }
    if (fraction.endsWith("0")) {
        addIssue(ctx, path, "fractional seconds must not have trailing zeros");
    }
}

/**
 * Create a duration schema.
 * @param signed Whether negative durations are allowed.
 * @return Zod schema.
 */
export function optionalDuration(signed: boolean) {
    return durationSchema(signed).optional();
}

/**
 * Create a duration schema.
 * @param signed Whether negative durations are allowed.
 * @return Zod schema.
 */
export function durationSchema(signed: boolean) {
    return z
        .string({ error: "must be a duration string" })
        .superRefine((value, ctx) => {
            checkDurationString(value, signed, ctx, []);
        });
}

/**
 * Validate an ISO 8601 duration string.
 * @param value Duration string.
 * @param signed Whether negative durations are allowed.
 * @param ctx Zod refinement context.
 * @param path Relative issue path.
 * @return Nothing.
 */
function checkDurationString(
    value: string,
    signed: boolean,
    ctx: z.RefinementCtx,
    path: Array<string | number>,
): void {
    if (!signed && value.startsWith("-")) {
        addIssue(ctx, path, "must not be negative");
        return;
    }
    const match = value.match(DURATION);
    if (!match) {
        addIssue(ctx, path, "must be an ISO 8601 duration");
        return;
    }
    const hasDate = !!match[1] || !!match[2] || !!match[3];
    const hasTime = !!match[4] || !!match[5] || !!match[6];
    if (!hasDate && !hasTime) {
        addIssue(ctx, path, "must include at least one duration component");
    }
    const fraction = match[7];
    if (fraction !== undefined) checkFraction(fraction, ctx, path);
}

/**
 * Create a schema for boolean maps.
 * @param keyedById Whether keys must be Ids.
 * @return Zod schema.
 */
export function optionalBooleanMap(keyedById: boolean) {
    return booleanMapSchema(keyedById).optional();
}

/**
 * Create a schema for boolean maps.
 * @param keyedById Whether keys must be Ids.
 * @return Zod schema.
 */
export function booleanMapSchema(keyedById: boolean) {
    return z
        .record(z.string(), z.literal(true), {
            error: (issue) =>
                issue.input === undefined ? undefined : "must be an object",
        })
        .superRefine((value, ctx) => {
            for (const [key, entry] of Object.entries(value)) {
                if (keyedById) checkId(key, ctx, [key]);
                if (entry !== true) addIssue(ctx, [key], "must be true");
            }
        });
}

/**
 * Create a schema for optional media type strings.
 * @param textOnly Whether the media type must be text.
 * @return Zod schema.
 */
export function optionalMediaType(textOnly: boolean) {
    return z
        .string()
        .optional()
        .superRefine((value, ctx) => {
            if (value === undefined) return;
            const [typePart, ...params] = value.split(";");
            const mediaType = (typePart ?? "").trim();
            if (textOnly && !mediaType.startsWith(TYPE_TEXT_PREFIX)) {
                addIssue(ctx, [], "must be a text/* media type");
                return;
            }
            if (
                !/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(
                    mediaType,
                )
            ) {
                addIssue(ctx, [], "must be a valid media type");
                return;
            }
            checkCharset(params, ctx);
        });
}

/**
 * Validate media type charset parameters.
 * @param params Media type parameter strings.
 * @param ctx Zod refinement context.
 * @return Nothing.
 */
function checkCharset(params: string[], ctx: z.RefinementCtx): void {
    for (const param of params) {
        const [rawKey, rawValue] = param.split("=");
        if (!rawKey || !rawValue) continue;
        const key = rawKey.trim().toLowerCase();
        const value = rawValue.trim().toLowerCase();
        if (key === CHARSET_KEY && value !== UTF8) {
            addIssue(ctx, [], "charset parameter must be utf-8");
        }
    }
}

/**
 * Create a schema for optional Content-ID strings.
 * @return Zod schema.
 */
export function optionalContentId() {
    return z
        .string()
        .optional()
        .superRefine((value, ctx) => {
            if (value === undefined) return;
            const trimmed = value.trim();
            const hasBrackets =
                trimmed.startsWith("<") || trimmed.endsWith(">");
            if (
                hasBrackets &&
                !(trimmed.startsWith("<") && trimmed.endsWith(">"))
            ) {
                addIssue(ctx, [], "must use matching angle brackets");
                return;
            }
            const raw = hasBrackets ? trimmed.slice(1, -1) : trimmed;
            if (!/^[^\s<>@]+@[^\s<>@]+$/.test(raw)) {
                addIssue(ctx, [], "must be a content-id");
            }
        });
}

/**
 * Create a schema for optional time zone IDs.
 * @return Zod schema.
 */
export function optionalTimeZone() {
    return timeZoneSchemaValue().nullish();
}

/**
 * Create a schema for a required time zone ID.
 * @return Zod schema.
 */
export function timeZoneSchemaValue() {
    return z.string().superRefine((value, ctx) => {
        if (value === undefined || value === null) return;
        if (!isSupportedTimeZone(value)) {
            addIssue(ctx, [], "must be a supported time zone ID");
        }
    });
}

/**
 * Create a schema for optional JSON values.
 * @return Zod schema.
 */
export function jsonValue() {
    return z.json();
}

/**
 * Create a schema for arrays of nested schema entries.
 * @param schema Entry schema.
 * @return Zod schema.
 */
export function arraySchema(schema: z.ZodType) {
    return z.array(schema).optional();
}

/**
 * Create a schema for integer arrays.
 * @param min Minimum integer.
 * @param max Maximum integer.
 * @param rejectZero Whether zero is invalid.
 * @param message Error message.
 * @return Zod schema.
 */
export function integerRangeArray(
    min: number,
    max: number,
    rejectZero: boolean,
    message: string,
) {
    return z
        .array(
            z
                .number()
                .int()
                .refine(
                    (value) =>
                        (!rejectZero || value !== 0) &&
                        value >= min &&
                        value <= max,
                    message,
                ),
        )
        .optional();
}

/**
 * Create a schema for non-zero integer arrays.
 * @return Zod schema.
 */
export function nonZeroIntegerArray() {
    return z
        .array(
            z
                .number()
                .int()
                .refine((value) => value !== 0, "must be a non-zero integer"),
        )
        .optional();
}

/**
 * Create a schema for byMonth arrays.
 * @return Zod schema.
 */
export function byMonthSchema() {
    return z
        .array(
            z.string().superRefine((entry, ctx) => {
                const numeric = Number.parseInt(entry, 10);
                if (!Number.isInteger(numeric) || numeric < 1 || numeric > 12) {
                    addIssue(
                        ctx,
                        [],
                        "must be a month number between 1 and 12",
                    );
                }
            }),
        )
        .optional();
}

/**
 * Create a schema for string arrays.
 * @return Zod schema.
 */
export function stringArraySchema() {
    return z.array(z.string()).optional();
}

/**
 * Create a schema for string records.
 * @param objectMessage Message used when the value is not an object.
 * @return Zod schema.
 */
export function stringRecordSchema(objectMessage: string) {
    return z
        .record(z.string(), z.string(), { error: objectMessage })
        .optional();
}

/**
 * Create a schema for maps with nested object values.
 * @param schema Entry schema.
 * @param entryMessage Message for non-object entries.
 * @param keyedById Whether keys must be Ids.
 * @param requireNonEmptyKey Whether keys must be non-empty strings.
 * @return Zod schema.
 */
export function mapSchema(
    schema: z.ZodType,
    entryMessage: string,
    keyedById: boolean,
    requireNonEmptyKey = false,
) {
    return z
        .record(z.string(), schema, { error: "must be an object" })
        .optional()
        .superRefine((value, ctx) => {
            if (value === undefined) return;
            for (const key of Object.keys(value)) {
                if (keyedById) checkId(key, ctx, [key]);
                if (requireNonEmptyKey && key.length === 0) {
                    addIssue(ctx, [key], "must not be empty");
                }
            }
        });
}

/**
 * Create a schema for Id-keyed maps.
 * @param schema Entry schema.
 * @param entryMessage Message for non-object entries.
 * @return Zod schema.
 */
export function idMapSchema(schema: z.ZodType, entryMessage: string) {
    return mapSchema(schema, entryMessage, true);
}

/**
 * Get the validation path for a schema.
 * @param path Optional root validation path override.
 * @return Root validation path.
 */
function validationPath(path?: string): string {
    return path ?? DEFAULT_VALIDATION_PATH;
}

/**
 * Validate a value with a schema and throw a ValidationError on failure.
 * @param schema Zod schema.
 * @param value Value to validate.
 * @param path Optional root validation path override.
 * @return Nothing.
 */
export function validateWithSchema(
    schema: z.ZodType,
    value: object,
    path?: string,
): void {
    const result = schema.safeParse(value);
    if (!result.success) {
        throwFirstIssue(result.error.issues, validationPath(path));
    }
}
