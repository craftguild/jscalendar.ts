import type { Event, Group, GroupPatch, Task } from "../types.js";
import { deepClone, nowUtc } from "../utils.js";
import { validateJsCalendarObject } from "../validate.js";
import { applyCommonDefaults } from "./defaults.js";
import { createUid } from "./ids.js";
import type { CreateOptions, GroupInput } from "./types.js";
import { Base } from "./base.js";
import { normalizeEntry } from "./normalize.js";
import { toUtcDateTime } from "./datetime.js";

export class GroupObject extends Base<Group, GroupPatch, GroupObject> {
  /**
   * Wrap updated data in a new GroupObject.
   * @param data Updated group data.
   * @return New GroupObject instance.
   */
  protected wrap(data: Group): GroupObject {
    const { "@type": _type, ...rest } = data;
    return new GroupObject(rest, { validate: false });
  }
  /**
   * Create a group with normalized entries and RFC defaults.
   * @param input Group input values to normalize.
   * @param options Creation options (validation, clock).
   * @return GroupObject instance.
   */
  constructor(input: GroupInput, options: CreateOptions = {}) {
    if (!Array.isArray(input.entries)) {
      throw new Error("Group.entries is required");
    }
    const now = options.now ?? nowUtc;
    const { updated: rawUpdated, created: rawCreated, ...rest } = input;
    const entries = input.entries.map((entry) => normalizeEntry(entry));
    const updated = rawUpdated ? toUtcDateTime(rawUpdated) : now();
    const data: Group = {
      ...rest,
      "@type": "Group",
      entries,
      uid: input.uid ?? createUid(),
      updated,
    };
    if (rawCreated) {
      data.created = toUtcDateTime(rawCreated);
    } else {
      data.created = updated;
    }
    applyCommonDefaults(data);
    if (options.validate !== false) {
      validateJsCalendarObject(data);
    }
    super(data);
  }

  /**
   * Clone the group as a new GroupObject instance.
   * @return Cloned GroupObject.
   */
  override clone(): GroupObject {
    return this.wrap(deepClone(this.data));
  }
}
