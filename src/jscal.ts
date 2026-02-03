import type { JSCalendarObject } from "./types.js";
import { toICal } from "./ical.js";
import { expandRecurrence, expandRecurrencePaged } from "./recurrence.js";
import { filterByDateRange, filterByText, filterByType, findByUid, groupByType } from "./search.js";
import { resolveTimeZone, TimeZones } from "./timezones.js";
import { applyPatch } from "./patch.js";
import { EventObject } from "./jscal/event.js";
import { TaskObject } from "./jscal/task.js";
import { GroupObject } from "./jscal/group.js";
import { Duration } from "./jscal/duration.js";
import { createId, createUid } from "./jscal/ids.js";
import { normalizeItems, normalizeToObjects } from "./jscal/normalize.js";
import { isEvent, isGroup, isTask } from "./jscal/guards.js";
import {
  buildAlert,
  buildAbsoluteTrigger,
  buildEventPatch,
  buildLink,
  buildLocation,
  buildNDay,
  buildOffsetTrigger,
  buildParticipants,
  buildRecurrenceRule,
  buildRelation,
  buildRelatedTo,
  buildTimeZone,
  buildTimeZoneMap,
  buildTimeZoneRule,
  buildVirtualLocation,
  buildVirtualLocations,
  buildLocations,
  buildLinks,
  buildParticipant,
  buildAlerts,
  buildTaskPatch,
  buildGroupPatch,
} from "./jscal/builders.js";
export type { CreateOptions, UpdateOptions } from "./jscal/types.js";
export type {
  AlertInput,
  AbsoluteTriggerInput,
  EventPatchInput,
  GroupPatchInput,
  IdValueInput,
  LinkInput,
  LocationInput,
  NDayInput,
  OffsetTriggerInput,
  ParticipantInput,
  RecurrenceRuleInput,
  RelationInput,
  TaskPatchInput,
  TimeZoneInput,
  TimeZoneRuleInput,
  VirtualLocationInput,
} from "./jscal/builders.js";

export { createId, createUid, isEvent, isGroup, isTask };

export const JsCal = {
  Event: EventObject,
  Task: TaskObject,
  Group: GroupObject,
  createUid,
  createId,
  isEvent,
  isGroup,
  isTask,
  duration: Duration,
  timeZone: resolveTimeZone,
  timeZones: TimeZones,
  applyPatch,
  Participant: buildParticipant,
  Location: buildLocation,
  VirtualLocation: buildVirtualLocation,
  Alert: buildAlert,
  OffsetTrigger: buildOffsetTrigger,
  AbsoluteTrigger: buildAbsoluteTrigger,
  Relation: buildRelation,
  Link: buildLink,
  TimeZone: buildTimeZone,
  TimeZoneRule: buildTimeZoneRule,
  RecurrenceRule: buildRecurrenceRule,
  NDay: buildNDay,
  // Alias for NDay to better mirror the byDay naming in recurrence rules.
  ByDay: buildNDay,
  EventPatch: buildEventPatch,
  TaskPatch: buildTaskPatch,
  GroupPatch: buildGroupPatch,
  participants: buildParticipants,
  locations: buildLocations,
  virtualLocations: buildVirtualLocations,
  alerts: buildAlerts,
  links: buildLinks,
  relatedTo: buildRelatedTo,
  timeZonesMap: buildTimeZoneMap,
  /**
   * Find a JSCalendar object by UID.
   * @param items JSCalendar objects or JsCal instances.
   * @param uid UID to match.
   * @return Matching object, if found.
   */
  findByUid(items: Array<JSCalendarObject | { data: JSCalendarObject }>, uid: string): JSCalendarObject | undefined {
    return findByUid(normalizeItems(items), uid);
  },
  /**
   * Filter JSCalendar objects by @type.
   * @param items JSCalendar objects or JsCal instances.
   * @param type JSCalendar @type to match.
   * @return Matching objects.
   */
  filterByType(items: Array<JSCalendarObject | { data: JSCalendarObject }>, type: JSCalendarObject["@type"]): JSCalendarObject[] {
    return filterByType(normalizeItems(items), type);
  },
  /**
   * Group JSCalendar objects by @type.
   * @param items JSCalendar objects or JsCal instances.
   * @return Record keyed by @type.
   */
  groupByType(items: Array<JSCalendarObject | { data: JSCalendarObject }>): Record<string, JSCalendarObject[]> {
    return groupByType(normalizeItems(items));
  },
  /**
   * Filter JSCalendar objects whose text fields match a query.
   * @param items JSCalendar objects or JsCal instances.
   * @param query Text query to match.
   * @return Matching objects.
   */
  filterByText(items: Array<JSCalendarObject | { data: JSCalendarObject }>, query: string): JSCalendarObject[] {
    return filterByText(normalizeItems(items), query);
  },
  /**
   * Filter JSCalendar objects that overlap a date range.
   * @param items JSCalendar objects or JsCal instances.
   * @param range Date range bounds.
   * @param options Range comparison options.
   * @return Matching objects.
   */
  filterByDateRange(
    items: Array<JSCalendarObject | { data: JSCalendarObject }>,
    range: import("./search.js").DateRange,
    options?: import("./search.js").DateRangeOptions,
  ): JSCalendarObject[] {
    return filterByDateRange(normalizeItems(items), range, options);
  },
  /**
   * Expand recurrence rules into concrete occurrences.
   * @param items JSCalendar objects or JsCal instances.
   * @param range Date range bounds.
   * @return Generator of expanded JSCalendar objects.
   */
  expandRecurrence(
    items: Array<JSCalendarObject | { data: JSCalendarObject }>,
    range: { from: Date; to: Date },
  ): Generator<JSCalendarObject> {
    return expandRecurrence(normalizeItems(items), range);
  },
  /**
   * Expand recurrence rules with pagination support.
   * @param items JSCalendar objects or JsCal instances.
   * @param range Date range bounds.
   * @param options Pagination options.
   * @return Page of expanded items plus an optional next cursor.
   */
  expandRecurrencePaged(
    items: Array<JSCalendarObject | { data: JSCalendarObject }>,
    range: { from: Date; to: Date },
    options: { limit: number; cursor?: string },
  ): { items: JSCalendarObject[]; nextCursor?: string } {
    return expandRecurrencePaged(normalizeItems(items), range, options);
  },
  /**
   * Convert JSCalendar objects to iCalendar text.
   * @param value JSCalendar objects or JsCal instances.
   * @param options iCalendar export options.
   * @return iCalendar text.
   */
  toICal(
    value: Array<JSCalendarObject | { data: JSCalendarObject }>,
    options?: import("./ical.js").ICalOptions,
  ): string {
    const objects = normalizeToObjects(value);
    return toICal(objects, options);
  },
};
