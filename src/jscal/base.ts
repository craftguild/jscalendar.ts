import type { Alert, Id, JSCalendarObject, Location, Participant, PatchObject, UTCDateTime, VirtualLocation } from "../types.js";
import { applyPatch } from "../patch.js";
import { deepClone, isNumberValue, nowUtc } from "../utils.js";
import { validateJsCalendarObject } from "../validate.js";
import type { UpdateOptions } from "./types.js";
import { KEY_PARTICIPANTS } from "./constants.js";
import { applyAlertDefaults, applyParticipantDefaults } from "./defaults.js";
import { createId } from "./ids.js";

export class Base<T extends JSCalendarObject> {
  data: T;

  /**
   * Create a new base instance that wraps a JSCalendar object.
   * @param data Underlying JSCalendar data.
   * @return Result.
   */
  constructor(data: T) {
    this.data = data;
  }

  /**
   * Return a deep-cloned plain object for safe serialization.
   * @return Cloned JSCalendar data.
   */
  eject(): T {
    return deepClone(this.data);
  }

  /**
   * Clone the current instance with a deep-cloned payload.
   * @return New instance with cloned data.
   */
  clone(): Base<T> {
    return new Base<T>(deepClone(this.data));
  }

  /**
   * Read a field value from the underlying data.
   * @param key Field key.
   * @return Field value.
   */
  get<K extends keyof T>(key: K): T[K] {
    return this.data[key];
  }

  /**
   * Set a field value and update metadata as needed.
   * @param key Field key.
   * @param value Field value.
   * @return Updated instance.
   */
  set<K extends keyof T>(key: K, value: T[K]): this {
    this.data[key] = value;
    return this.touchKeys([String(key)]);
  }

  /**
   * Apply shallow updates and touch updated/sequence metadata.
   * @param values Partial values to merge.
   * @param options Update options.
   * @return Updated instance.
   */
  update(values: Partial<T>, options: UpdateOptions = {}): this {
    const next = { ...this.data, ...values };
    if (options.validate !== false) {
      validateJsCalendarObject(next);
    }
    this.data = next;
    return this.touchKeys(Object.keys(values), options);
  }

  /**
   * Apply a PatchObject and touch updated/sequence metadata.
   * @param patch Patch to apply.
   * @param options Update options.
   * @return Updated instance.
   */
  patch(patch: PatchObject, options: UpdateOptions = {}): this {
    const next = applyPatch(this.data, patch);
    if (options.validate !== false) {
      validateJsCalendarObject(next);
    }
    this.data = next;
    return this.touchFromPatch(patch, options);
  }

  /**
   * Add a physical location and return its generated ID.
   * @param location Location data (without @type).
   * @param id Optional location ID.
   * @return Location ID.
   */
  addLocation(location: Omit<Location, "@type"> & Partial<Pick<Location, "@type">>, id?: Id): Id {
    const actualId = id ?? createId();
    if (!this.data.locations) this.data.locations = {};
    this.data.locations[actualId] = { ...location, "@type": "Location" };
    this.touchKeys(["locations"]);
    return actualId;
  }

  /**
   * Add a virtual location and return its generated ID.
   * @param location Virtual location data (without @type).
   * @param id Optional virtual location ID.
   * @return Virtual location ID.
   */
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

  /**
   * Add a participant and return its generated ID.
   * @param participant Participant data (without @type).
   * @param id Optional participant ID.
   * @return Participant ID.
   */
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

  /**
   * Add an alert and return its generated ID.
   * @param alert Alert data (without @type).
   * @param id Optional alert ID.
   * @return Alert ID.
   */
  addAlert(alert: Omit<Alert, "@type"> & Partial<Pick<Alert, "@type">>, id?: Id): Id {
    const actualId = id ?? createId();
    if (!this.data.alerts) this.data.alerts = {};
    const filled = applyAlertDefaults({ ...alert, "@type": "Alert" });
    this.data.alerts[actualId] = filled;
    this.touchKeys(["alerts"]);
    return actualId;
  }

  /**
   * Update updated/sequence metadata for modified keys.
   * @param keys Modified keys.
   * @param options Update options.
   * @return Updated instance.
   */
  protected touchKeys(keys: string[], options: UpdateOptions = {}): this {
    if (options.touch === false) return this;
    const now = options.now ?? nowUtc;
    this.data.updated = now();
    if (options.sequence === false) return this;
    const onlyParticipants = keys.length > 0 && keys.every((key) => key === KEY_PARTICIPANTS);
    if (!onlyParticipants) {
      const current = isNumberValue(this.data.sequence) ? this.data.sequence : 0;
      this.data.sequence = current + 1;
    }
    return this;
  }

  /**
   * Update updated/sequence metadata for PatchObject changes.
   * @param patch Patch applied to the object.
   * @param options Update options.
   * @return Updated instance.
   */
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
      const current = isNumberValue(this.data.sequence) ? this.data.sequence : 0;
      this.data.sequence = current + 1;
    }
    return this;
  }
}
