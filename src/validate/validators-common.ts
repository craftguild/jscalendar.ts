import type { Alert, JSCalendarObject, Link, Location, Participant, Relation, TimeZone, TimeZoneRule, VirtualLocation } from "../types.js";
import { TimeZones } from "../timezones.js";
import { fail } from "./error.js";
import { TYPE_ABSOLUTE_TRIGGER, TYPE_ALERT, TYPE_LINK, TYPE_LOCATION, TYPE_OFFSET_TRIGGER, TYPE_PARTICIPANT, TYPE_RELATION, TYPE_TIME_ZONE, TYPE_TIME_ZONE_RULE, TYPE_VIRTUAL_LOCATION } from "./constants.js";
import { assertBoolean, assertBooleanMap, assertContentId, assertId, assertIdBooleanMap, assertInteger, assertJsonValue, assertLocalDateTime, assertMediaType, assertNonEmptyString, assertPatchObject, assertSignedDuration, assertString, assertTextContentType, assertTimeZone, assertUnsignedInt, assertUtcDateTime, isRecord } from "./asserts.js";
import { validateRecurrenceRule } from "./validators-recurrence.js";
import { isObjectValue, isStringValue } from "../utils.js";

/**
 * Validate alert structure.
 * @param value Alert object to validate.
 * @param path JSON pointer path for error messages.
 * @return Nothing.
 */
export function validateAlert(value: Alert, path: string): void {
  if (value["@type"] !== TYPE_ALERT) fail(path, "must have @type Alert");
  if (!value.trigger) fail(`${path}.trigger`, "is required");
  if (value.trigger["@type"] === TYPE_OFFSET_TRIGGER) {
    const offset = value.trigger.offset;
    if (!isStringValue(offset)) {
      fail(`${path}.trigger.offset`, "must be a duration string");
    }
    assertSignedDuration(offset, `${path}.trigger.offset`);
  } else if (value.trigger["@type"] === TYPE_ABSOLUTE_TRIGGER) {
    const when = value.trigger.when;
    if (!isStringValue(when)) {
      fail(`${path}.trigger.when`, "must be a UTCDateTime string");
    }
    assertUtcDateTime(when, `${path}.trigger.when`);
  }
  assertUtcDateTime(value.acknowledged, `${path}.acknowledged`);
  assertString(value.action, `${path}.action`);
  if (value.relatedTo) {
    if (!isObjectValue(value.relatedTo) || value.relatedTo === null || Array.isArray(value.relatedTo)) {
      fail(`${path}.relatedTo`, "must be an object");
    }
    for (const [key, entry] of Object.entries(value.relatedTo)) {
      if (!entry || !isObjectValue(entry)) {
        fail(`${path}.relatedTo.${key}`, "must be a relation object");
      }
      validateRelation(entry, `${path}.relatedTo.${key}`);
    }
  }
}
/**
 * Validate relation structure.
 * @param value Relation object to validate.
 * @param path JSON pointer path for error messages.
 * @return Nothing.
 */
export function validateRelation(value: Relation, path: string): void {
  if (value["@type"] !== TYPE_RELATION) fail(path, "must have @type Relation");
  if (value.relation) assertBooleanMap(value.relation, `${path}.relation`);
}
/**
 * Validate link structure.
 * @param value Link object to validate.
 * @param path JSON pointer path for error messages.
 * @return Nothing.
 */
export function validateLink(value: Link, path: string): void {
  if (value["@type"] !== TYPE_LINK) fail(path, "must have @type Link");
  assertString(value.href, `${path}.href`);
  if (!value.href) fail(`${path}.href`, "is required");
  assertContentId(value.cid, `${path}.cid`);
  assertMediaType(value.contentType, `${path}.contentType`);
  assertUnsignedInt(value.size, `${path}.size`);
  assertString(value.rel, `${path}.rel`);
  assertString(value.display, `${path}.display`);
  assertString(value.title, `${path}.title`);
}
/**
 * Validate location structure.
 * @param value Location object to validate.
 * @param path JSON pointer path for error messages.
 * @return Nothing.
 */
export function validateLocation(value: Location, path: string): void {
  if (value["@type"] !== TYPE_LOCATION) fail(path, "must have @type Location");
  assertId(value.relativeTo, `${path}.relativeTo`);
  assertString(value.name, `${path}.name`);
  assertString(value.description, `${path}.description`);
  if (value.locationTypes) assertBooleanMap(value.locationTypes, `${path}.locationTypes`);
  assertString(value.relativeTo, `${path}.relativeTo`);
  assertTimeZone(value.timeZone, `${path}.timeZone`);
  assertString(value.coordinates, `${path}.coordinates`);
  if (value.links) {
    if (!isObjectValue(value.links) || value.links === null || Array.isArray(value.links)) {
      fail(`${path}.links`, "must be an object");
    }
    for (const [key, entry] of Object.entries(value.links)) {
      assertId(key, `${path}.links.${key}`);
      if (!entry || !isObjectValue(entry)) {
        fail(`${path}.links.${key}`, "must be a link object");
      }
      validateLink(entry, `${path}.links.${key}`);
    }
  }
}
/**
 * Validate virtual location structure.
 * @param value VirtualLocation object to validate.
 * @param path JSON pointer path for error messages.
 * @return Nothing.
 */
export function validateVirtualLocation(value: VirtualLocation, path: string): void {
  if (value["@type"] !== TYPE_VIRTUAL_LOCATION) fail(path, "must have @type VirtualLocation");
  assertString(value.name, `${path}.name`);
  assertString(value.description, `${path}.description`);
  assertString(value.uri, `${path}.uri`);
  if (!value.uri) fail(`${path}.uri`, "is required");
  if (value.features) assertBooleanMap(value.features, `${path}.features`);
}
/**
 * Validate time zone rule structure.
 * @param value TimeZoneRule object to validate.
 * @param path JSON pointer path for error messages.
 * @return Nothing.
 */
export function validateTimeZoneRule(value: TimeZoneRule, path: string): void {
  if (value["@type"] !== TYPE_TIME_ZONE_RULE) fail(path, "must have @type TimeZoneRule");
  assertLocalDateTime(value.start, `${path}.start`);
  if (!value.start) fail(`${path}.start`, "is required");
  assertString(value.offsetFrom, `${path}.offsetFrom`);
  if (!value.offsetFrom) fail(`${path}.offsetFrom`, "is required");
  assertString(value.offsetTo, `${path}.offsetTo`);
  if (!value.offsetTo) fail(`${path}.offsetTo`, "is required");
  if (value.recurrenceRules) {
    value.recurrenceRules.forEach((rule, index) => validateRecurrenceRule(rule, `${path}.recurrenceRules[${index}]`));
  }
  if (value.comments) {
    value.comments.forEach((entry, index) => assertString(entry, `${path}.comments[${index}]`));
  }
}
/**
 * Validate time zone object structure.
 * @param value TimeZone object to validate.
 * @param path JSON pointer path for error messages.
 * @return Nothing.
 */
export function validateTimeZoneObject(value: TimeZone, path: string): void {
  if (value["@type"] !== TYPE_TIME_ZONE) fail(path, "must have @type TimeZone");
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
/**
 * Validate participant structure.
 * @param value Participant object to validate.
 * @param path JSON pointer path for error messages.
 * @return Nothing.
 */
export function validateParticipant(value: Participant, path: string): void {
  if (value["@type"] !== TYPE_PARTICIPANT) fail(path, "must have @type Participant");
  assertString(value.name, `${path}.name`);
  assertString(value.email, `${path}.email`);
  assertString(value.description, `${path}.description`);
  if (value.sendTo) {
    if (!isObjectValue(value.sendTo) || value.sendTo === null || Array.isArray(value.sendTo)) {
      fail(`${path}.sendTo`, "must be an object");
    }
    for (const [key, entry] of Object.entries(value.sendTo)) {
      assertString(key, `${path}.sendTo.${key}`);
      assertString(entry, `${path}.sendTo.${key}`);
    }
  }
  assertString(value.kind, `${path}.kind`);
  if (!value.roles) {
    fail(`${path}.roles`, "is required");
  }
  assertBooleanMap(value.roles, `${path}.roles`);
  if (Object.keys(value.roles).length === 0) {
    fail(`${path}.roles`, "must include at least one role");
  }
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
    if (!isObjectValue(value.links) || value.links === null || Array.isArray(value.links)) {
      fail(`${path}.links`, "must be an object");
    }
    for (const [key, entry] of Object.entries(value.links)) {
      assertId(key, `${path}.links.${key}`);
      if (!entry || !isObjectValue(entry)) {
        fail(`${path}.links.${key}`, "must be a link object");
      }
      validateLink(entry, `${path}.links.${key}`);
    }
  }
  assertString(value.progress, `${path}.progress`);
  assertUtcDateTime(value.progressUpdated, `${path}.progressUpdated`);
  assertUnsignedInt(value.percentComplete, `${path}.percentComplete`);
}
/**
 * Validate common structure.
 * @param value JSCalendar object to validate.
 * @param path JSON pointer path for error messages.
 * @return Nothing.
 */
export function validateCommon(value: JSCalendarObject, path: string): void {
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
    if (!isObjectValue(value.relatedTo) || value.relatedTo === null || Array.isArray(value.relatedTo)) {
      fail(`${path}.relatedTo`, "must be an object");
    }
    for (const [key, entry] of Object.entries(value.relatedTo)) {
      assertNonEmptyString(key, `${path}.relatedTo.${key}`);
      if (!entry || !isObjectValue(entry)) {
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
    if (!isObjectValue(value.recurrenceOverrides) || value.recurrenceOverrides === null || Array.isArray(value.recurrenceOverrides)) {
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
    if (!isObjectValue(value.replyTo) || value.replyTo === null || Array.isArray(value.replyTo)) {
      fail(`${path}.replyTo`, "must be an object");
    }
    for (const [key, entry] of Object.entries(value.replyTo)) {
      assertString(entry, `${path}.replyTo.${key}`);
    }
  }
  assertString(value.sentBy, `${path}.sentBy`);
  if (value.locations) {
    if (!isObjectValue(value.locations) || value.locations === null || Array.isArray(value.locations)) {
      fail(`${path}.locations`, "must be an object");
    }
    for (const [key, entry] of Object.entries(value.locations)) {
      assertId(key, `${path}.locations.${key}`);
      if (!entry || !isObjectValue(entry)) {
        fail(`${path}.locations.${key}`, "must be a location object");
      }
      validateLocation(entry, `${path}.locations.${key}`);
    }
  }
  if (value.virtualLocations) {
    if (!isObjectValue(value.virtualLocations) || value.virtualLocations === null || Array.isArray(value.virtualLocations)) {
      fail(`${path}.virtualLocations`, "must be an object");
    }
    for (const [key, entry] of Object.entries(value.virtualLocations)) {
      assertId(key, `${path}.virtualLocations.${key}`);
      if (!entry || !isObjectValue(entry)) {
        fail(`${path}.virtualLocations.${key}`, "must be a virtual location object");
      }
      validateVirtualLocation(entry, `${path}.virtualLocations.${key}`);
    }
  }
  if (value.links) {
    if (!isObjectValue(value.links) || value.links === null || Array.isArray(value.links)) {
      fail(`${path}.links`, "must be an object");
    }
    for (const [key, entry] of Object.entries(value.links)) {
      assertId(key, `${path}.links.${key}`);
      if (!entry || !isObjectValue(entry)) {
        fail(`${path}.links.${key}`, "must be a link object");
      }
      validateLink(entry, `${path}.links.${key}`);
    }
  }
  if (value.participants) {
    if (!isObjectValue(value.participants) || value.participants === null || Array.isArray(value.participants)) {
      fail(`${path}.participants`, "must be an object");
    }
    for (const [key, entry] of Object.entries(value.participants)) {
      assertId(key, `${path}.participants.${key}`);
      if (!entry || !isObjectValue(entry)) {
        fail(`${path}.participants.${key}`, "must be a participant object");
      }
      validateParticipant(entry, `${path}.participants.${key}`);
    }
  }
  assertString(value.requestStatus, `${path}.requestStatus`);
  assertBoolean(value.useDefaultAlerts, `${path}.useDefaultAlerts`);
  if (value.alerts) {
    if (!isObjectValue(value.alerts) || value.alerts === null || Array.isArray(value.alerts)) {
      fail(`${path}.alerts`, "must be an object");
    }
    for (const [key, entry] of Object.entries(value.alerts)) {
      assertId(key, `${path}.alerts.${key}`);
      if (!entry || !isObjectValue(entry)) {
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
    if (!isObjectValue(timeZones) || timeZones === null || Array.isArray(timeZones)) {
      fail(`${path}.timeZones`, "must be an object");
    }
    for (const [key] of Object.entries(timeZones)) {
      assertTimeZone(key, `${path}.timeZones.${key}`);
    }
    for (const [key, entry] of Object.entries(timeZones)) {
      if (!entry || !isObjectValue(entry)) {
        fail(`${path}.timeZones.${key}`, "must be a time zone object");
      }
      validateTimeZoneObject(entry, `${path}.timeZones.${key}`);
    }
  }
}
