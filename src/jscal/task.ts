import type { Task, TaskPatch } from "../types.js";
import { resolveTimeZone } from "../timezones.js";
import { deepClone, nowUtc } from "../utils.js";
import { validateJsCalendarObject } from "../validate.js";
import { applyCommonDefaults, applyTaskDefaults } from "./defaults.js";
import { createUid } from "./ids.js";
import { toLocalDateTime, toUtcDateTime } from "./datetime.js";
import type { CreateOptions, TaskInput } from "./types.js";
import { Base } from "./base.js";

export class TaskObject extends Base<Task, TaskPatch, TaskObject> {
  /**
   * Wrap updated data in a new TaskObject.
   * @param data Updated task data.
   * @return New TaskObject instance.
   */
  protected wrap(data: Task): TaskObject {
    const { "@type": _type, ...rest } = data;
    return new TaskObject(rest, { validate: false });
  }

  /**
   * Create a task with normalized date fields and RFC defaults applied.
   * @param input Task input values to normalize.
   * @param options Creation options (validation, clock).
   * @return TaskObject instance.
   */
  constructor(input: TaskInput = {}, options: CreateOptions = {}) {
    const now = options.now ?? nowUtc;
    const {
      start: rawStart,
      due: rawDue,
      updated: rawUpdated,
      created: rawCreated,
      timeZone: rawTimeZone,
      ...rest
    } = input;
    const updated = rawUpdated ? toUtcDateTime(rawUpdated) : now();
    let timeZone: Task["timeZone"];
    if (rawTimeZone === null) {
      timeZone = null;
    } else if (rawTimeZone) {
      timeZone = resolveTimeZone(rawTimeZone);
    }
    const data: Task = {
      ...rest,
      "@type": "Task",
      uid: input.uid ?? createUid(),
      updated,
    };
    if (rawStart) data.start = toLocalDateTime(rawStart);
    if (rawDue) data.due = toLocalDateTime(rawDue);
    if (timeZone !== undefined) data.timeZone = timeZone;
    if (rawCreated) {
      data.created = toUtcDateTime(rawCreated);
    } else {
      data.created = updated;
    }
    applyCommonDefaults(data);
    applyTaskDefaults(data);
    if (options.validate !== false) {
      validateJsCalendarObject(data);
    }
    super(data);
  }

  /**
   * Clone the task as a new TaskObject instance.
   * @return Cloned TaskObject.
   */
  override clone(): TaskObject {
    return this.wrap(deepClone(this.data));
  }
}
