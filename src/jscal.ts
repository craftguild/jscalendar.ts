import type {
  Alert,
  Event,
  Group,
  Id,
  JSCalendarObject,
  Location,
  Participant,
  PatchObject,
  Task,
  TimeZoneInput,
  UTCDateTime,
  VirtualLocation,
} from "./types.js";
import { applyPatch } from "./patch.js";
import { deepClone, normalizeUtcDateTime, nowUtc } from "./utils.js";
import { toICal } from "./ical.js";
import { expandRecurrence, expandRecurrencePaged } from "./recurrence.js";
import { validateJsCalendarObject } from "./validate.js";
import {
  filterByDateRange,
  filterByText,
  filterByType,
  findByUid,
  groupByType,
} from "./search.js";
import { resolveTimeZone, TimeZones } from "./timezones.js";

export type CreateOptions = {
  now?: () => UTCDateTime;
  validate?: boolean;
};

export type UpdateOptions = {
  touch?: boolean;
  sequence?: boolean;
  now?: () => UTCDateTime;
  validate?: boolean;
};

type DateInput = string | Date;
type DurationInput = string | number;
type EntryInput = Event | Task | { data: Event | Task };
type EventInput = Omit<Event, "@type" | "uid" | "updated" | "created" | "start" | "duration" | "timeZone"> & {
  start: DateInput;
  duration?: DurationInput;
  timeZone?: TimeZoneInput | null;
  uid?: string;
  updated?: DateInput;
  created?: DateInput;
};

type TaskInput = Omit<Task, "@type" | "uid" | "updated" | "created" | "start" | "due" | "timeZone"> & {
  uid?: string;
  updated?: DateInput;
  created?: DateInput;
  start?: DateInput;
  due?: DateInput;
  timeZone?: TimeZoneInput | null;
};

type GroupInput = Omit<Group, "@type" | "uid" | "updated" | "created" | "entries"> & {
  entries: EntryInput[];
  uid?: string;
  updated?: DateInput;
  created?: DateInput;
};

function getCrypto(): Crypto | undefined {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    return cryptoObj;
  }
  return undefined;
}

function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const cryptoObj = getCrypto();
  if (cryptoObj) {
    cryptoObj.getRandomValues(bytes);
    return bytes;
  }
  for (let i = 0; i < length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

function base64UrlEncode(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;

    const triplet = ((b0 ?? 0) << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);

    output += alphabet[(triplet >> 18) & 0x3f] ?? "";
    output += alphabet[(triplet >> 12) & 0x3f] ?? "";
    output += i + 1 < bytes.length ? alphabet[(triplet >> 6) & 0x3f] ?? "" : "=";
    output += i + 2 < bytes.length ? alphabet[triplet & 0x3f] ?? "" : "=";
  }
  return output.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function createUid(): string {
  const cryptoObj = getCrypto();
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }
  const bytes = getRandomBytes(16);
  if (bytes.length > 6) {
    const b6 = bytes[6] ?? 0;
    bytes[6] = (b6 & 0x0f) | 0x40;
  }
  if (bytes.length > 8) {
    const b8 = bytes[8] ?? 0;
    bytes[8] = (b8 & 0x3f) | 0x80;
  }
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createId(): Id {
  return base64UrlEncode(getRandomBytes(16));
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function toLocalDateTime(value: DateInput): string {
  if (typeof value === "string") return value;
  return [
    value.getFullYear().toString().padStart(4, "0"),
    "-",
    pad2(value.getMonth() + 1),
    "-",
    pad2(value.getDate()),
    "T",
    pad2(value.getHours()),
    ":",
    pad2(value.getMinutes()),
    ":",
    pad2(value.getSeconds()),
  ].join("");
}

function toUtcDateTime(value: DateInput): UTCDateTime {
  if (typeof value === "string") return value;
  return normalizeUtcDateTime(value.toISOString());
}

function durationFromSeconds(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(clamped / 86400);
  let remaining = clamped % 86400;
  const hours = Math.floor(remaining / 3600);
  remaining %= 3600;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  const datePart = days > 0 ? `${days}D` : "";
  const timeParts: string[] = [];
  if (hours > 0) timeParts.push(`${hours}H`);
  if (minutes > 0) timeParts.push(`${minutes}M`);
  if (seconds > 0 || (datePart === "" && timeParts.length === 0)) {
    timeParts.push(`${seconds}S`);
  }
  const timePart = timeParts.length > 0 ? `T${timeParts.join("")}` : "";
  return `P${datePart}${timePart}`;
}

const Duration = {
  seconds(value: number): string {
    return durationFromSeconds(value);
  },
  minutes(value: number): string {
    return durationFromSeconds(value * 60);
  },
  hours(value: number): string {
    return durationFromSeconds(value * 3600);
  },
  days(value: number): string {
    return durationFromSeconds(value * 86400);
  },
  from(parts: { days?: number; hours?: number; minutes?: number; seconds?: number }): string {
    const seconds = (parts.days ?? 0) * 86400 +
      (parts.hours ?? 0) * 3600 +
      (parts.minutes ?? 0) * 60 +
      (parts.seconds ?? 0);
    return durationFromSeconds(seconds);
  },
};

function applyCommonDefaults<T extends JSCalendarObject>(data: T): T {
  if (data.sequence === undefined) data.sequence = 0;
  if (data.title === undefined) data.title = "";
  if (data.description === undefined) data.description = "";
  if (data.descriptionContentType === undefined) data.descriptionContentType = "text/plain";
  if (data.showWithoutTime === undefined) data.showWithoutTime = false;
  if (data.recurrenceIdTimeZone === undefined) data.recurrenceIdTimeZone = null;
  if (data.excluded === undefined) data.excluded = false;
  if (data.priority === undefined) data.priority = 0;
  if (data.freeBusyStatus === undefined) data.freeBusyStatus = "busy";
  if (data.privacy === undefined) data.privacy = "public";
  if (data.useDefaultAlerts === undefined) data.useDefaultAlerts = false;
  return data;
}

function applyEventDefaults(data: Event): Event {
  if (data.duration === undefined) data.duration = "PT0S";
  if (data.status === undefined) data.status = "confirmed";
  return data;
}

function applyTaskDefaults(data: Task): Task {
  if (data.progress === undefined) {
    const participants = data.participants ? Object.values(data.participants) : [];
    if (participants.length === 0) {
      data.progress = "needs-action";
    } else if (participants.every((p) => p.progress === "completed")) {
      data.progress = "completed";
    } else if (participants.some((p) => p.progress === "failed")) {
      data.progress = "failed";
    } else if (participants.some((p) => p.progress === "in-process")) {
      data.progress = "in-process";
    } else {
      data.progress = "needs-action";
    }
  }
  return data;
}

function applyParticipantDefaults(participant: Participant): Participant {
  if (participant.participationStatus === undefined) participant.participationStatus = "needs-action";
  if (participant.expectReply === undefined) participant.expectReply = false;
  if (participant.scheduleAgent === undefined) participant.scheduleAgent = "server";
  if (participant.scheduleForceSend === undefined) participant.scheduleForceSend = false;
  if (participant.scheduleSequence === undefined) participant.scheduleSequence = 0;
  return participant;
}

function applyAlertDefaults(alert: Alert): Alert {
  if (alert.action === undefined) alert.action = "display";
  if (alert.trigger["@type"] === "OffsetTrigger") {
    if (alert.trigger.relativeTo === undefined) {
      alert.trigger.relativeTo = "start";
    }
  }
  return alert;
}

export function isEvent(obj: JSCalendarObject): obj is Event {
  return obj["@type"] === "Event";
}

export function isTask(obj: JSCalendarObject): obj is Task {
  return obj["@type"] === "Task";
}

export function isGroup(obj: JSCalendarObject): obj is Group {
  return obj["@type"] === "Group";
}

class Base<T extends JSCalendarObject> {
  data: T;

  constructor(data: T) {
    this.data = data;
  }

  eject(): T {
    return deepClone(this.data);
  }

  clone(): Base<T> {
    return new Base<T>(deepClone(this.data));
  }

  get<K extends keyof T>(key: K): T[K] {
    return this.data[key];
  }

  set<K extends keyof T>(key: K, value: T[K]): this {
    this.data[key] = value;
    return this.touchKeys([String(key)]);
  }

  update(values: Partial<T>, options: UpdateOptions = {}): this {
    const next = { ...this.data, ...values };
    if (options.validate !== false) {
      validateJsCalendarObject(next);
    }
    this.data = next;
    return this.touchKeys(Object.keys(values), options);
  }

  patch(patch: PatchObject, options: UpdateOptions = {}): this {
    const next = applyPatch(this.data, patch);
    if (options.validate !== false) {
      validateJsCalendarObject(next);
    }
    this.data = next;
    return this.touchFromPatch(patch, options);
  }

  addLocation(location: Omit<Location, "@type"> & Partial<Pick<Location, "@type">>, id?: Id): Id {
    const actualId = id ?? createId();
    if (!this.data.locations) this.data.locations = {};
    this.data.locations[actualId] = { ...location, "@type": "Location" };
    this.touchKeys(["locations"]);
    return actualId;
  }

  addVirtualLocation(
    location: Omit<VirtualLocation, "@type"> & Partial<Pick<VirtualLocation, "@type">>,
    id?: Id,
  ): Id {
    const actualId = id ?? createId();
    if (!this.data.virtualLocations) this.data.virtualLocations = {};
    const name = location.name ?? "";
    this.data.virtualLocations[actualId] = { ...location, name, "@type": "VirtualLocation" };
    this.touchKeys(["virtualLocations"]);
    return actualId;
  }

  addParticipant(
    participant: Omit<Participant, "@type"> & Partial<Pick<Participant, "@type">>,
    id?: Id,
  ): Id {
    const actualId = id ?? createId();
    if (!this.data.participants) this.data.participants = {};
    const filled = applyParticipantDefaults({ ...participant, "@type": "Participant" });
    this.data.participants[actualId] = filled;
    this.touchKeys(["participants"], { sequence: false });
    return actualId;
  }

  addAlert(alert: Omit<Alert, "@type"> & Partial<Pick<Alert, "@type">>, id?: Id): Id {
    const actualId = id ?? createId();
    if (!this.data.alerts) this.data.alerts = {};
    const filled = applyAlertDefaults({ ...alert, "@type": "Alert" });
    this.data.alerts[actualId] = filled;
    this.touchKeys(["alerts"]);
    return actualId;
  }

  protected touchKeys(keys: string[], options: UpdateOptions = {}): this {
    if (options.touch === false) return this;
    const now = options.now ?? nowUtc;
    this.data.updated = now();
    if (options.sequence === false) return this;
    const onlyParticipants = keys.length > 0 && keys.every((key) => key === "participants");
    if (!onlyParticipants) {
      const current = typeof this.data.sequence === "number" ? this.data.sequence : 0;
      this.data.sequence = current + 1;
    }
    return this;
  }

  protected touchFromPatch(patch: PatchObject, options: UpdateOptions = {}): this {
    if (options.touch === false) return this;
    const now = options.now ?? nowUtc;
    this.data.updated = now();
    if (options.sequence === false) return this;
    const pointers = Object.keys(patch);
    const onlyParticipants =
      pointers.length > 0 &&
      pointers.every((pointer) => {
        const normalized = pointer.startsWith("/") ? pointer.slice(1) : pointer;
        return normalized.startsWith("participants");
      });
    if (!onlyParticipants) {
      const current = typeof this.data.sequence === "number" ? this.data.sequence : 0;
      this.data.sequence = current + 1;
    }
    return this;
  }
}

class EventObject extends Base<Event> {
  constructor(input: EventInput, options: CreateOptions = {}) {
    if (typeof input.start !== "string" && !(input.start instanceof Date)) {
      throw new Error("Event.start is required");
    }
    if (typeof input.start === "string" && input.start.length === 0) {
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
      data.duration = typeof rawDuration === "number"
        ? durationFromSeconds(rawDuration)
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

  override clone(): EventObject {
    const cloneData = deepClone(this.data);
    const { "@type": _type, ...rest } = cloneData;
    return new EventObject(rest);
  }
}

class TaskObject extends Base<Task> {
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

  override clone(): TaskObject {
    const cloneData = deepClone(this.data);
    const { "@type": _type, ...rest } = cloneData;
    return new TaskObject(rest);
  }
}

class GroupObject extends Base<Group> {
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

  addEntry(entry: Event | Task | { data: Event | Task }): this {
    const entries = [...this.data.entries, normalizeEntry(entry)];
    this.data.entries = entries;
    this.touchKeys(["entries"]);
    return this;
  }

  override clone(): GroupObject {
    const cloneData = deepClone(this.data);
    const { "@type": _type, ...rest } = cloneData;
    return new GroupObject(rest);
  }
}

export const JsCal = {
  Event: EventObject,
  Task: TaskObject,
  Group: GroupObject,
  createUid,
  createId,
  duration: Duration,
  timeZone: resolveTimeZone,
  timeZones: TimeZones,
  applyPatch,
  findByUid(items: Array<JSCalendarObject | { data: JSCalendarObject }>, uid: string): JSCalendarObject | undefined {
    return findByUid(normalizeItems(items), uid);
  },
  filterByType(items: Array<JSCalendarObject | { data: JSCalendarObject }>, type: JSCalendarObject["@type"]): JSCalendarObject[] {
    return filterByType(normalizeItems(items), type);
  },
  groupByType(items: Array<JSCalendarObject | { data: JSCalendarObject }>): Record<string, JSCalendarObject[]> {
    return groupByType(normalizeItems(items));
  },
  filterByText(items: Array<JSCalendarObject | { data: JSCalendarObject }>, query: string): JSCalendarObject[] {
    return filterByText(normalizeItems(items), query);
  },
  filterByDateRange(
    items: Array<JSCalendarObject | { data: JSCalendarObject }>,
    range: import("./search.js").DateRange,
    options?: import("./search.js").DateRangeOptions,
  ): JSCalendarObject[] {
    return filterByDateRange(normalizeItems(items), range, options);
  },
  expandRecurrence(
    items: Array<JSCalendarObject | { data: JSCalendarObject }>,
    range: { from: Date; to: Date },
  ): Generator<JSCalendarObject> {
    return expandRecurrence(normalizeItems(items), range);
  },
  expandRecurrencePaged(
    items: Array<JSCalendarObject | { data: JSCalendarObject }>,
    range: { from: Date; to: Date },
    options: { limit: number; cursor?: string },
  ): { items: JSCalendarObject[]; nextCursor?: string } {
    return expandRecurrencePaged(normalizeItems(items), range, options);
  },
  toICal(
    value: Array<JSCalendarObject | { data: JSCalendarObject }>,
    options?: import("./ical.js").ICalOptions,
  ): string {
    const objects = normalizeToObjects(value);
    return toICal(objects, options);
  },
};

function isJsCalInstance(value: object): value is { data: JSCalendarObject } {
  return "data" in value;
}

function normalizeItems(items: Array<JSCalendarObject | { data: JSCalendarObject }>): JSCalendarObject[] {
  const mapped: JSCalendarObject[] = [];
  for (const entry of items) {
    if (typeof entry === "object" && entry !== null && isJsCalInstance(entry)) {
      mapped.push(entry.data);
    } else {
      mapped.push(entry);
    }
  }
  return mapped;
}

function normalizeEntry(entry: EntryInput): Event | Task {
  if (typeof entry === "object" && entry !== null && isJsCalInstance(entry)) {
    return entry.data;
  }
  return entry;
}

function normalizeToObjects(
  value: Array<JSCalendarObject | { data: JSCalendarObject }>,
): JSCalendarObject[] {
  return normalizeItems(value);
}
