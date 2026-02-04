import type { Event, Group, JSCalendarObject, Task } from "../types.js";
import { TYPE_EVENT, TYPE_GROUP, TYPE_TASK } from "./constants.js";

/**
 * Type guard for JSCalendar Event objects.
 * @param obj JSCalendar object to check.
 * @return True when the object is an Event.
 */
export function isEvent(obj: JSCalendarObject): obj is Event {
    return obj["@type"] === TYPE_EVENT;
}

/**
 * Type guard for JSCalendar Task objects.
 * @param obj JSCalendar object to check.
 * @return True when the object is a Task.
 */
export function isTask(obj: JSCalendarObject): obj is Task {
    return obj["@type"] === TYPE_TASK;
}

/**
 * Type guard for JSCalendar Group objects.
 * @param obj JSCalendar object to check.
 * @return True when the object is a Group.
 */
export function isGroup(obj: JSCalendarObject): obj is Group {
    return obj["@type"] === TYPE_GROUP;
}
