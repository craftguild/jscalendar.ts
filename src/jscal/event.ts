import type { Event } from "../types.js";
import { resolveTimeZone } from "../timezones.js";
import { deepClone, nowUtc } from "../utils.js";
import { validateJsCalendarObject } from "../validate.js";
import { applyCommonDefaults, applyEventDefaults } from "./defaults.js";
import { durationFromSeconds } from "./duration.js";
import { createUid } from "./ids.js";
import { toLocalDateTime, toUtcDateTime } from "./datetime.js";
import type { CreateOptions, EventInput } from "./types.js";
import { Base } from "./base.js";
import { isStringValue, isNumberValue } from "../utils.js";

export class EventObject extends Base<Event> {
  /**
   * Create an event with normalized dates, duration, and RFC defaults.
   * @param input Event input values to normalize.
   * @param options Creation options (validation, clock).
   * @return EventObject instance.
   */
  constructor(input: EventInput, options: CreateOptions = {}) {
    if (!isStringValue(input.start) && !(input.start instanceof Date)) {
      throw new Error("Event.start is required");
    }
    if (isStringValue(input.start) && input.start.length === 0) {
      throw new Error("Event.start is required");
    }
    const now = options.now ?? nowUtc;
    const {
      start: rawStart,
      duration: rawDuration,
      updated: rawUpdated,
      created: rawCreated,
      timeZone: rawTimeZone,
      ...rest
    } = input;
    const start = toLocalDateTime(rawStart);
    const updated = rawUpdated ? toUtcDateTime(rawUpdated) : now();
    let timeZone: Event["timeZone"];
    if (rawTimeZone === null) {
      timeZone = null;
    } else if (rawTimeZone) {
      timeZone = resolveTimeZone(rawTimeZone);
    }
    const data: Event = {
      ...rest,
      "@type": "Event",
      start,
      uid: input.uid ?? createUid(),
      updated,
    };
    if (timeZone !== undefined) data.timeZone = timeZone;
    if (rawDuration !== undefined) {
      data.duration = isNumberValue(rawDuration)
        ? durationFromSeconds(Math.max(0, rawDuration))
        : rawDuration;
    }
    if (rawCreated) {
      data.created = toUtcDateTime(rawCreated);
    } else {
      data.created = updated;
    }
    applyCommonDefaults(data);
    applyEventDefaults(data);
    if (options.validate !== false) {
      validateJsCalendarObject(data);
    }
    super(data);
  }

  /**
   * Clone the event as a new EventObject instance.
   * @return Cloned EventObject.
   */
  override clone(): EventObject {
    const cloneData = deepClone(this.data);
    const { "@type": _type, ...rest } = cloneData;
    return new EventObject(rest);
  }
}
