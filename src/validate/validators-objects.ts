import type { Event, Group, JSCalendarObject, Task } from "../types.js";
import { fail } from "./error.js";
import { TYPE_EVENT, TYPE_GROUP, TYPE_TASK } from "./constants.js";
import {
    assertDuration,
    assertLocalDateTime,
    assertString,
    assertUnsignedInt,
    assertUtcDateTime,
} from "./asserts.js";
import { validateCommon } from "./validators-common.js";
import { isObjectValue } from "../utils.js";

/**
 * Validate event structure.
 * @param value Event object to validate.
 * @param path JSON pointer path for error messages.
 * @return Nothing.
 */
function validateEvent(value: Event, path: string): void {
    if (value["@type"] !== TYPE_EVENT) fail(path, "must have @type Event");
    validateCommon(value, path);
    assertLocalDateTime(value.start, `${path}.start`);
    if (!value.start) fail(`${path}.start`, "is required");
    assertDuration(value.duration, `${path}.duration`);
    assertString(value.status, `${path}.status`);
}

/**
 * Validate task structure.
 * @param value Task object to validate.
 * @param path JSON pointer path for error messages.
 * @return Nothing.
 */
function validateTask(value: Task, path: string): void {
    if (value["@type"] !== TYPE_TASK) fail(path, "must have @type Task");
    validateCommon(value, path);
    assertLocalDateTime(value.start, `${path}.start`);
    assertLocalDateTime(value.due, `${path}.due`);
    assertDuration(value.estimatedDuration, `${path}.estimatedDuration`);
    assertUnsignedInt(value.percentComplete, `${path}.percentComplete`);
    assertString(value.progress, `${path}.progress`);
    assertUtcDateTime(value.progressUpdated, `${path}.progressUpdated`);
}

/**
 * Validate group structure.
 * @param value Group object to validate.
 * @param path JSON pointer path for error messages.
 * @return Nothing.
 */
function validateGroup(value: Group, path: string): void {
    if (value["@type"] !== TYPE_GROUP) fail(path, "must have @type Group");
    validateCommon(value, path);
    if (!Array.isArray(value.entries))
        fail(`${path}.entries`, "must be an array");
    value.entries.forEach((entry, index) =>
        validateJsCalendarObject(entry, `${path}.entries[${index}]`),
    );
    assertString(value.source, `${path}.source`);
}

/**
 * Validate js calendar object structure.
 * @param value JSCalendar object to validate.
 * @param path JSON pointer path for error messages.
 * @return Nothing.
 */
export function validateJsCalendarObject(
    value: JSCalendarObject,
    path = "object",
): void {
    if (!value || !isObjectValue(value)) fail(path, "must be an object");
    if (value["@type"] === TYPE_EVENT) return validateEvent(value, path);
    if (value["@type"] === TYPE_TASK) return validateTask(value, path);
    if (value["@type"] === TYPE_GROUP) return validateGroup(value, path);
    fail(`${path}["@type"]`, "must be Event, Task, or Group");
}
