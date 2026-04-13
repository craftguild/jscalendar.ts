import { z } from "zod";
import {
    RSCALE_GREGORIAN,
    TYPE_ABSOLUTE_TRIGGER,
    TYPE_ALERT,
    TYPE_EVENT,
    TYPE_GROUP,
    TYPE_LINK,
    TYPE_LOCATION,
    TYPE_NDAY,
    TYPE_OFFSET_TRIGGER,
    TYPE_PARTICIPANT,
    TYPE_RECURRENCE_RULE,
    TYPE_RELATION,
    TYPE_TASK,
    TYPE_TIME_ZONE,
    TYPE_TIME_ZONE_RULE,
    TYPE_VIRTUAL_LOCATION,
} from "./constants.js";
import {
    addIssue,
    arraySchema,
    booleanMapSchema,
    byMonthSchema,
    checkDateTimeString,
    dateTimeSchema,
    durationSchema,
    idMapSchema,
    integerRangeArray,
    isDayOfWeek,
    isParticipantRole,
    isRecurrenceFrequency,
    isSkipValue,
    isSupportedTimeZone,
    isVendorSpecificValue,
    jsonValue,
    mapSchema,
    nonZeroIntegerArray,
    objectSchema,
    optionalBoolean,
    optionalBooleanMap,
    optionalContentId,
    optionalDateTime,
    optionalDuration,
    optionalId,
    optionalInteger,
    optionalMediaType,
    optionalString,
    optionalTimeZone,
    optionalUnsignedInteger,
    stringArraySchema,
    stringRecordSchema,
    timeZoneSchemaValue,
} from "./common.js";

/**
 * Validate Relation objects embedded in relatedTo and alert relations.
 */
const relationSchema = objectSchema({
    "@type": z.literal(TYPE_RELATION),
    relation: optionalBooleanMap(false),
});

/**
 * Validate Link objects used by common object link maps.
 */
const linkSchema = objectSchema({
    "@type": z.literal(TYPE_LINK),
    href: z.string(),
    cid: optionalContentId(),
    contentType: optionalMediaType(false),
    size: optionalUnsignedInteger(),
    rel: optionalString(),
    display: optionalString(),
    title: optionalString(),
});

/**
 * Validate Location objects used by event, task, and group locations.
 */
const locationSchema = objectSchema({
    "@type": z.literal(TYPE_LOCATION),
    name: optionalString(),
    description: optionalString(),
    locationTypes: optionalBooleanMap(false),
    relativeTo: optionalId(),
    timeZone: optionalTimeZone(),
    coordinates: optionalString(),
    links: idMapSchema(linkSchema, "must be a link object"),
});

/**
 * Validate VirtualLocation objects used by virtual location maps.
 */
const virtualLocationSchema = objectSchema({
    "@type": z.literal(TYPE_VIRTUAL_LOCATION),
    name: optionalString(),
    description: optionalString(),
    uri: z.string(),
    features: optionalBooleanMap(false),
});

/**
 * Validate participant role maps, including RFC roles and vendor extensions.
 */
const participantRolesSchema = booleanMapSchema(false)
    .refine((value) => Object.keys(value).length > 0, {
        message: "must include at least one role",
    })
    .superRefine((value, ctx) => {
        for (const role of Object.keys(value)) {
            if (isParticipantRole(role) || isVendorSpecificValue(role)) {
                continue;
            }
            addIssue(
                ctx,
                [role],
                "must be a standard participant role or vendor-specific value",
            );
        }
    });

/**
 * Validate Participant objects used by participant maps.
 */
const participantSchema = objectSchema({
    "@type": z.literal(TYPE_PARTICIPANT),
    name: optionalString(),
    email: optionalString(),
    description: optionalString(),
    sendTo: stringRecordSchema("must be an object"),
    kind: optionalString(),
    roles: participantRolesSchema,
    locationId: optionalId(),
    language: optionalString(),
    participationStatus: optionalString(),
    participationComment: optionalString(),
    expectReply: optionalBoolean(),
    scheduleAgent: optionalString(),
    scheduleForceSend: optionalBoolean(),
    scheduleSequence: optionalUnsignedInteger(),
    scheduleStatus: stringArraySchema(),
    scheduleUpdated: optionalDateTime(true),
    sentBy: optionalString(),
    invitedBy: optionalId(),
    delegatedTo: optionalBooleanMap(true),
    delegatedFrom: optionalBooleanMap(true),
    memberOf: optionalBooleanMap(true),
    links: idMapSchema(linkSchema, "must be a link object"),
    progress: optionalString(),
    progressUpdated: optionalDateTime(true),
    percentComplete: optionalUnsignedInteger(),
});

/**
 * Validate OffsetTrigger objects for relative alert timing.
 */
const offsetTriggerSchema = objectSchema({
    "@type": z.literal(TYPE_OFFSET_TRIGGER),
    offset: durationSchema(true),
    relativeTo: optionalString(),
});

/**
 * Validate AbsoluteTrigger objects for fixed UTC alert timing.
 */
const absoluteTriggerSchema = objectSchema({
    "@type": z.literal(TYPE_ABSOLUTE_TRIGGER),
    when: dateTimeSchema(true),
});

/**
 * Validate alert trigger values accepted by the trigger property.
 */
const triggerSchema = z
    .object({
        "@type": z.string(),
    })
    .catchall(jsonValue())
    .superRefine((value, ctx) => {
        if (value["@type"] === TYPE_OFFSET_TRIGGER) {
            const result = offsetTriggerSchema.safeParse(value);
            if (!result.success) {
                for (const issue of result.error.issues) {
                    addIssue(
                        ctx,
                        issue.path.map((segment) =>
                            typeof segment === "number"
                                ? segment
                                : String(segment),
                        ),
                        issue.message,
                    );
                }
            }
            return;
        }
        if (value["@type"] === TYPE_ABSOLUTE_TRIGGER) {
            const result = absoluteTriggerSchema.safeParse(value);
            if (!result.success) {
                for (const issue of result.error.issues) {
                    addIssue(
                        ctx,
                        issue.path.map((segment) =>
                            typeof segment === "number"
                                ? segment
                                : String(segment),
                        ),
                        issue.message,
                    );
                }
            }
        }
    });

/**
 * Validate Alert objects used by alert maps.
 */
const alertSchema = objectSchema({
    "@type": z.literal(TYPE_ALERT),
    trigger: triggerSchema,
    acknowledged: optionalDateTime(true),
    relatedTo: mapSchema(relationSchema, "must be a relation object", false),
    action: optionalString(),
});

/**
 * Validate NDay objects used in recurrence byDay rules.
 */
const ndaySchema = objectSchema({
    "@type": z.literal(TYPE_NDAY),
    day: z.string().superRefine((value, ctx) => {
        if (!isDayOfWeek(value)) {
            addIssue(ctx, [], "must be a valid day of week");
        }
    }),
    nthOfPeriod: optionalInteger(),
});

/**
 * Validate RecurrenceRule objects used by recurrence rule arrays.
 */
const recurrenceRuleSchema = objectSchema({
    "@type": z.literal(TYPE_RECURRENCE_RULE),
    frequency: z
        .string()
        .refine(
            (value) => isRecurrenceFrequency(value),
            "must be a valid frequency",
        ),
    interval: optionalUnsignedInteger(),
    rscale: z
        .string()
        .refine(
            (value) => value === RSCALE_GREGORIAN,
            "only gregorian is supported",
        )
        .optional(),
    skip: z
        .string()
        .refine(
            (value) => isSkipValue(value),
            "must be omit, backward, or forward",
        )
        .optional(),
    firstDayOfWeek: z
        .string()
        .refine((value) => isDayOfWeek(value), "must be a valid day of week")
        .optional(),
    byDay: arraySchema(ndaySchema),
    byMonthDay: integerRangeArray(
        -31,
        31,
        true,
        "must be an integer between -31 and 31, excluding 0",
    ),
    byMonth: byMonthSchema(),
    byYearDay: integerRangeArray(
        -366,
        366,
        true,
        "must be an integer between -366 and 366, excluding 0",
    ),
    byWeekNo: integerRangeArray(
        -53,
        53,
        true,
        "must be an integer between -53 and 53, excluding 0",
    ),
    byHour: integerRangeArray(
        0,
        23,
        false,
        "must be an integer between 0 and 23",
    ),
    byMinute: integerRangeArray(
        0,
        59,
        false,
        "must be an integer between 0 and 59",
    ),
    bySecond: integerRangeArray(
        0,
        59,
        false,
        "must be an integer between 0 and 59",
    ),
    bySetPosition: nonZeroIntegerArray(),
    count: optionalUnsignedInteger(),
    until: optionalDateTime(false),
});

/**
 * Create schemas for JSCalendar PatchObject maps.
 * @return PatchObject schema.
 */
const patchObjectSchema = () =>
    z
        .record(z.string(), z.json(), { error: "must be a PatchObject" })
        .optional();

/**
 * Validate TimeZoneRule objects used by custom time zone definitions.
 */
const timeZoneRuleSchema = objectSchema({
    "@type": z.literal(TYPE_TIME_ZONE_RULE),
    start: dateTimeSchema(false),
    offsetFrom: z.string(),
    offsetTo: z.string(),
    recurrenceRules: arraySchema(recurrenceRuleSchema),
    recurrenceOverrides: mapSchema(
        patchObjectSchema(),
        "must be a PatchObject",
        false,
    ),
    names: optionalBooleanMap(false),
    comments: stringArraySchema(),
});

/**
 * Validate TimeZone objects used by timeZones maps.
 */
const timeZoneSchema = objectSchema({
    "@type": z.literal(TYPE_TIME_ZONE),
    tzId: timeZoneSchemaValue(),
    updated: optionalDateTime(true),
    url: optionalString(),
    validUntil: optionalDateTime(true),
    aliases: optionalBooleanMap(false),
    standard: arraySchema(timeZoneRuleSchema),
    daylight: arraySchema(timeZoneRuleSchema),
});

/**
 * Create schemas for recurrence override PatchObject maps keyed by LocalDateTime.
 * @return Recurrence override schema.
 */
const recurrenceOverrideSchema = () =>
    z
        .record(z.string(), patchObjectSchema(), { error: "must be an object" })
        .optional()
        .superRefine((value, ctx) => {
            if (value === undefined) return;
            for (const key of Object.keys(value)) {
                checkDateTimeString(key, false, ctx, [key]);
            }
        });

/**
 * Create schemas for time zone maps keyed by supported time zone IDs.
 * @return Time zone map schema.
 */
const timeZonesSchema = () =>
    z
        .record(z.string(), timeZoneSchema, { error: "must be an object" })
        .optional()
        .superRefine((value, ctx) => {
            if (value === undefined) return;
            for (const key of Object.keys(value)) {
                if (!isSupportedTimeZone(key)) {
                    addIssue(ctx, [key], "must be a supported time zone ID");
                }
            }
        });

/**
 * Validate Event objects with required start and event-specific fields.
 */
const eventSchema = objectSchema({
    "@type": z.literal(TYPE_EVENT),
    uid: z.string().min(1, "must not be empty"),
    relatedTo: mapSchema(
        relationSchema,
        "must be a relation object",
        false,
        true,
    ),
    prodId: optionalString(),
    updated: optionalDateTime(true),
    created: optionalDateTime(true),
    sequence: optionalUnsignedInteger(),
    method: z
        .string()
        .refine((value) => value === value.toLowerCase(), "must be lowercase")
        .nullish(),
    title: optionalString(),
    description: optionalString(),
    descriptionContentType: optionalMediaType(true),
    showWithoutTime: optionalBoolean(),
    locations: idMapSchema(locationSchema, "must be a location object"),
    virtualLocations: idMapSchema(
        virtualLocationSchema,
        "must be a virtual location object",
    ),
    links: idMapSchema(linkSchema, "must be a link object"),
    locale: optionalString(),
    keywords: optionalBooleanMap(false),
    categories: optionalBooleanMap(false),
    color: optionalString(),
    recurrenceId: optionalDateTime(false),
    recurrenceIdTimeZone: optionalTimeZone(),
    recurrenceRules: arraySchema(recurrenceRuleSchema),
    excludedRecurrenceRules: arraySchema(recurrenceRuleSchema),
    recurrenceOverrides: recurrenceOverrideSchema(),
    excluded: optionalBoolean(),
    priority: optionalInteger(),
    freeBusyStatus: optionalString(),
    privacy: optionalString(),
    replyTo: stringRecordSchema("must be an object"),
    sentBy: optionalString(),
    participants: idMapSchema(
        participantSchema,
        "must be a participant object",
    ),
    requestStatus: optionalString(),
    useDefaultAlerts: optionalBoolean(),
    alerts: idMapSchema(alertSchema, "must be an alert object"),
    localizations: mapSchema(
        patchObjectSchema(),
        "must be a PatchObject",
        false,
    ),
    timeZone: optionalTimeZone(),
    timeZones: timeZonesSchema(),
    start: dateTimeSchema(false),
    duration: optionalDuration(false),
    status: optionalString(),
});

/**
 * Validate Task objects with task-specific date and progress fields.
 */
const taskSchema = objectSchema({
    "@type": z.literal(TYPE_TASK),
    uid: z.string().min(1, "must not be empty"),
    relatedTo: mapSchema(
        relationSchema,
        "must be a relation object",
        false,
        true,
    ),
    prodId: optionalString(),
    updated: optionalDateTime(true),
    created: optionalDateTime(true),
    sequence: optionalUnsignedInteger(),
    method: z
        .string()
        .refine((value) => value === value.toLowerCase(), "must be lowercase")
        .nullish(),
    title: optionalString(),
    description: optionalString(),
    descriptionContentType: optionalMediaType(true),
    showWithoutTime: optionalBoolean(),
    locations: idMapSchema(locationSchema, "must be a location object"),
    virtualLocations: idMapSchema(
        virtualLocationSchema,
        "must be a virtual location object",
    ),
    links: idMapSchema(linkSchema, "must be a link object"),
    locale: optionalString(),
    keywords: optionalBooleanMap(false),
    categories: optionalBooleanMap(false),
    color: optionalString(),
    recurrenceId: optionalDateTime(false),
    recurrenceIdTimeZone: optionalTimeZone(),
    recurrenceRules: arraySchema(recurrenceRuleSchema),
    excludedRecurrenceRules: arraySchema(recurrenceRuleSchema),
    recurrenceOverrides: recurrenceOverrideSchema(),
    excluded: optionalBoolean(),
    priority: optionalInteger(),
    freeBusyStatus: optionalString(),
    privacy: optionalString(),
    replyTo: stringRecordSchema("must be an object"),
    sentBy: optionalString(),
    participants: idMapSchema(
        participantSchema,
        "must be a participant object",
    ),
    requestStatus: optionalString(),
    useDefaultAlerts: optionalBoolean(),
    alerts: idMapSchema(alertSchema, "must be an alert object"),
    localizations: mapSchema(
        patchObjectSchema(),
        "must be a PatchObject",
        false,
    ),
    timeZone: optionalTimeZone(),
    timeZones: timeZonesSchema(),
    due: optionalDateTime(false),
    start: optionalDateTime(false),
    estimatedDuration: optionalDuration(false),
    percentComplete: optionalUnsignedInteger(),
    progress: optionalString(),
    progressUpdated: optionalDateTime(true),
});

/**
 * Validate Group objects containing event and task entries.
 */
const groupSchema = objectSchema({
    "@type": z.literal(TYPE_GROUP),
    uid: z.string().min(1, "must not be empty"),
    relatedTo: mapSchema(
        relationSchema,
        "must be a relation object",
        false,
        true,
    ),
    prodId: optionalString(),
    updated: optionalDateTime(true),
    created: optionalDateTime(true),
    sequence: optionalUnsignedInteger(),
    method: z
        .string()
        .refine((value) => value === value.toLowerCase(), "must be lowercase")
        .nullish(),
    title: optionalString(),
    description: optionalString(),
    descriptionContentType: optionalMediaType(true),
    showWithoutTime: optionalBoolean(),
    locations: idMapSchema(locationSchema, "must be a location object"),
    virtualLocations: idMapSchema(
        virtualLocationSchema,
        "must be a virtual location object",
    ),
    links: idMapSchema(linkSchema, "must be a link object"),
    locale: optionalString(),
    keywords: optionalBooleanMap(false),
    categories: optionalBooleanMap(false),
    color: optionalString(),
    recurrenceId: optionalDateTime(false),
    recurrenceIdTimeZone: optionalTimeZone(),
    recurrenceRules: arraySchema(recurrenceRuleSchema),
    excludedRecurrenceRules: arraySchema(recurrenceRuleSchema),
    recurrenceOverrides: recurrenceOverrideSchema(),
    excluded: optionalBoolean(),
    priority: optionalInteger(),
    freeBusyStatus: optionalString(),
    privacy: optionalString(),
    replyTo: stringRecordSchema("must be an object"),
    sentBy: optionalString(),
    participants: idMapSchema(
        participantSchema,
        "must be a participant object",
    ),
    requestStatus: optionalString(),
    useDefaultAlerts: optionalBoolean(),
    alerts: idMapSchema(alertSchema, "must be an alert object"),
    localizations: mapSchema(
        patchObjectSchema(),
        "must be a PatchObject",
        false,
    ),
    timeZone: optionalTimeZone(),
    timeZones: timeZonesSchema(),
    entries: z.array(z.lazy(() => jsCalendarObjectSchema)),
    source: optionalString(),
});

/**
 * Validate any supported root JSCalendar object by @type discriminator.
 */
const jsCalendarObjectSchema = z.discriminatedUnion("@type", [
    eventSchema,
    taskSchema,
    groupSchema,
]);

/**
 * Validate Event PatchObject builder inputs.
 */
const eventPatchSchema = patchObjectSchema();

/**
 * Validate Task PatchObject builder inputs.
 */
const taskPatchSchema = patchObjectSchema();

/**
 * Validate Group PatchObject builder inputs.
 */
const groupPatchSchema = patchObjectSchema();

export {
    absoluteTriggerSchema,
    alertSchema,
    eventPatchSchema,
    eventSchema,
    groupPatchSchema,
    groupSchema,
    jsCalendarObjectSchema,
    linkSchema,
    locationSchema,
    ndaySchema,
    offsetTriggerSchema,
    participantSchema,
    patchObjectSchema,
    recurrenceRuleSchema,
    relationSchema,
    taskPatchSchema,
    taskSchema,
    timeZoneRuleSchema,
    timeZoneSchema,
    triggerSchema,
    virtualLocationSchema,
};
