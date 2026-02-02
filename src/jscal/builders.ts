import type {
  Alert,
  Link,
  Location,
  NDay,
  Participant,
  RecurrenceRule,
  Relation,
  TimeZone,
  TimeZoneRule,
  VirtualLocation,
  Id,
} from "../types.js";
import { createId } from "./ids.js";
import { validateAlert, validateLink, validateLocation, validateParticipant, validateRelation, validateTimeZoneObject, validateTimeZoneRule, validateVirtualLocation } from "../validate/validators-common.js";
import { validateNDay, validateRecurrenceRule } from "../validate/validators-recurrence.js";
import { fail } from "../validate/error.js";

const TYPE_PARTICIPANT = "Participant";
const TYPE_LOCATION = "Location";
const TYPE_VIRTUAL_LOCATION = "VirtualLocation";
const TYPE_ALERT = "Alert";
const TYPE_RELATION = "Relation";
const TYPE_LINK = "Link";
const TYPE_TIME_ZONE = "TimeZone";
const TYPE_TIME_ZONE_RULE = "TimeZoneRule";
const TYPE_RECURRENCE_RULE = "RecurrenceRule";
const TYPE_NDAY = "NDay";

type WithOptionalType<T, TypeName extends string> = Omit<T, "@type"> & { "@type"?: TypeName };

export type ParticipantInput = WithOptionalType<Participant, typeof TYPE_PARTICIPANT>;
export type LocationInput = WithOptionalType<Location, typeof TYPE_LOCATION>;
export type VirtualLocationInput = WithOptionalType<VirtualLocation, typeof TYPE_VIRTUAL_LOCATION>;
export type AlertInput = WithOptionalType<Alert, typeof TYPE_ALERT>;
export type RelationInput = WithOptionalType<Relation, typeof TYPE_RELATION>;
export type LinkInput = WithOptionalType<Link, typeof TYPE_LINK>;
export type TimeZoneInput = WithOptionalType<TimeZone, typeof TYPE_TIME_ZONE>;
export type TimeZoneRuleInput = WithOptionalType<TimeZoneRule, typeof TYPE_TIME_ZONE_RULE>;
export type RecurrenceRuleInput = WithOptionalType<RecurrenceRule, typeof TYPE_RECURRENCE_RULE>;
export type NDayInput = WithOptionalType<NDay, typeof TYPE_NDAY>;

/**
 * Build a Participant object with @type set and validated.
 * @param input Participant fields without @type.
 * @return Validated Participant object.
 */
export function buildParticipant(input: ParticipantInput): Participant {
  if (input["@type"] && input["@type"] !== TYPE_PARTICIPANT) {
    fail("participant", `must have @type ${TYPE_PARTICIPANT}`);
  }
  const participant: Participant = { ...input, "@type": TYPE_PARTICIPANT };
  validateParticipant(participant, "participant");
  return participant;
}

/**
 * Build a Location object with @type set and validated.
 * @param input Location fields without @type.
 * @return Validated Location object.
 */
export function buildLocation(input: LocationInput): Location {
  if (input["@type"] && input["@type"] !== TYPE_LOCATION) {
    fail("location", `must have @type ${TYPE_LOCATION}`);
  }
  const location: Location = { ...input, "@type": TYPE_LOCATION };
  validateLocation(location, "location");
  return location;
}

/**
 * Build a VirtualLocation object with @type set and validated.
 * @param input VirtualLocation fields without @type.
 * @return Validated VirtualLocation object.
 */
export function buildVirtualLocation(input: VirtualLocationInput): VirtualLocation {
  if (input["@type"] && input["@type"] !== TYPE_VIRTUAL_LOCATION) {
    fail("virtualLocation", `must have @type ${TYPE_VIRTUAL_LOCATION}`);
  }
  const virtualLocation: VirtualLocation = { ...input, "@type": TYPE_VIRTUAL_LOCATION };
  validateVirtualLocation(virtualLocation, "virtualLocation");
  return virtualLocation;
}

/**
 * Build an Alert object with @type set and validated.
 * @param input Alert fields without @type.
 * @return Validated Alert object.
 */
export function buildAlert(input: AlertInput): Alert {
  if (input["@type"] && input["@type"] !== TYPE_ALERT) {
    fail("alert", `must have @type ${TYPE_ALERT}`);
  }
  const alert: Alert = { ...input, "@type": TYPE_ALERT };
  validateAlert(alert, "alert");
  return alert;
}

/**
 * Build a Relation object with @type set and validated.
 * @param input Relation fields without @type.
 * @return Validated Relation object.
 */
export function buildRelation(input: RelationInput): Relation {
  if (input["@type"] && input["@type"] !== TYPE_RELATION) {
    fail("relation", `must have @type ${TYPE_RELATION}`);
  }
  const relation: Relation = { ...input, "@type": TYPE_RELATION };
  validateRelation(relation, "relation");
  return relation;
}

/**
 * Build a Link object with @type set and validated.
 * @param input Link fields without @type.
 * @return Validated Link object.
 */
export function buildLink(input: LinkInput): Link {
  if (input["@type"] && input["@type"] !== TYPE_LINK) {
    fail("link", `must have @type ${TYPE_LINK}`);
  }
  const link: Link = { ...input, "@type": TYPE_LINK };
  validateLink(link, "link");
  return link;
}

/**
 * Build a TimeZone object with @type set and validated.
 * @param input TimeZone fields without @type.
 * @return Validated TimeZone object.
 */
export function buildTimeZone(input: TimeZoneInput): TimeZone {
  if (input["@type"] && input["@type"] !== TYPE_TIME_ZONE) {
    fail("timeZone", `must have @type ${TYPE_TIME_ZONE}`);
  }
  const timeZone: TimeZone = { ...input, "@type": TYPE_TIME_ZONE };
  validateTimeZoneObject(timeZone, "timeZone");
  return timeZone;
}

/**
 * Build a TimeZoneRule object with @type set and validated.
 * @param input TimeZoneRule fields without @type.
 * @return Validated TimeZoneRule object.
 */
export function buildTimeZoneRule(input: TimeZoneRuleInput): TimeZoneRule {
  if (input["@type"] && input["@type"] !== TYPE_TIME_ZONE_RULE) {
    fail("timeZoneRule", `must have @type ${TYPE_TIME_ZONE_RULE}`);
  }
  const rule: TimeZoneRule = { ...input, "@type": TYPE_TIME_ZONE_RULE };
  validateTimeZoneRule(rule, "timeZoneRule");
  return rule;
}

/**
 * Build a RecurrenceRule object with @type set and validated.
 * @param input RecurrenceRule fields without @type.
 * @return Validated RecurrenceRule object.
 */
export function buildRecurrenceRule(input: RecurrenceRuleInput): RecurrenceRule {
  if (input["@type"] && input["@type"] !== TYPE_RECURRENCE_RULE) {
    fail("recurrenceRule", `must have @type ${TYPE_RECURRENCE_RULE}`);
  }
  const rule: RecurrenceRule = { ...input, "@type": TYPE_RECURRENCE_RULE };
  validateRecurrenceRule(rule, "recurrenceRule");
  return rule;
}

/**
 * Build an NDay object with @type set and validated.
 * @param input NDay fields without @type.
 * @return Validated NDay object.
 */
export function buildNDay(input: NDayInput): NDay {
  if (input["@type"] && input["@type"] !== TYPE_NDAY) {
    fail("nday", `must have @type ${TYPE_NDAY}`);
  }
  const nday: NDay = { ...input, "@type": TYPE_NDAY };
  validateNDay(nday, "nday");
  return nday;
}

/**
 * Build a record keyed by generated Ids.
 * @param items Items to store.
 * @param builder Builder function to validate each item.
 * @param idFn Optional ID generator.
 * @return Record keyed by generated Ids.
 */
export function buildIdMap<TInput, TOutput>(
  items: TInput[],
  builder: (input: TInput) => TOutput,
  idFn: (input: TInput, index: number) => Id = () => createId(),
): Record<Id, TOutput> {
  const result: Record<Id, TOutput> = {};
  items.forEach((item, index) => {
    const id = idFn(item, index);
    result[id] = builder(item);
  });
  return result;
}

/**
 * Build a record of Participant objects keyed by generated Ids.
 * @param items Participant inputs.
 * @return Participant record keyed by Id.
 */
export function buildParticipants(items: ParticipantInput[]): Record<Id, Participant> {
  return buildIdMap(items, buildParticipant);
}

/**
 * Build a record of Location objects keyed by generated Ids.
 * @param items Location inputs.
 * @return Location record keyed by Id.
 */
export function buildLocations(items: LocationInput[]): Record<Id, Location> {
  return buildIdMap(items, buildLocation);
}

/**
 * Build a record of VirtualLocation objects keyed by generated Ids.
 * @param items VirtualLocation inputs.
 * @return VirtualLocation record keyed by Id.
 */
export function buildVirtualLocations(items: VirtualLocationInput[]): Record<Id, VirtualLocation> {
  return buildIdMap(items, buildVirtualLocation);
}

/**
 * Build a record of Alert objects keyed by generated Ids.
 * @param items Alert inputs.
 * @return Alert record keyed by Id.
 */
export function buildAlerts(items: AlertInput[]): Record<Id, Alert> {
  return buildIdMap(items, buildAlert);
}

/**
 * Build a record of Link objects keyed by generated Ids.
 * @param items Link inputs.
 * @return Link record keyed by Id.
 */
export function buildLinks(items: LinkInput[]): Record<Id, Link> {
  return buildIdMap(items, buildLink);
}

/**
 * Build a record of Relation objects keyed by generated Ids.
 * @param items Relation inputs.
 * @return Relation record keyed by Id.
 */
export function buildRelatedTo(items: RelationInput[]): Record<Id, Relation> {
  return buildIdMap(items, buildRelation);
}

/**
 * Build a record of TimeZone objects keyed by tzId.
 * @param items TimeZone inputs.
 * @return TimeZone record keyed by tzId.
 */
export function buildTimeZoneMap(items: TimeZoneInput[]): Record<string, TimeZone> {
  const result: Record<string, TimeZone> = {};
  items.forEach((item) => {
    const timeZone = buildTimeZone(item);
    result[timeZone.tzId] = timeZone;
  });
  return result;
}
