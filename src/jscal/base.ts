import type { JSCalendarObject, PatchLike } from "../types.js";
import { applyPatch } from "../patch.js";
import { deepClone, isNumberValue, nowUtc } from "../utils.js";
import { validateJsCalendarObject } from "../validate.js";
import type { UpdateOptions } from "./types.js";

export abstract class Base<
    T extends JSCalendarObject,
    TPatch extends PatchLike,
    TSelf extends Base<T, TPatch, TSelf>,
> {
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
     * Wrap updated data in a new instance.
     * @param data Updated JSCalendar data.
     * @return New instance containing the data.
     */
    protected abstract wrap(data: T): TSelf;

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
    clone(): TSelf {
        return this.wrap(deepClone(this.data));
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
     * @return New instance with the updated field.
     */
    set<K extends keyof T>(key: K, value: T[K]): TSelf {
        const next = deepClone(this.data);
        next[key] = value;
        const touched = this.touchKeys(next, [String(key)]);
        return this.wrap(touched);
    }

    /**
     * Apply a PatchObject and touch updated/sequence metadata.
     * @param patch Patch to apply.
     * @param options Update options.
     * @return New instance with applied patch.
     */
    patch(patch: TPatch, options: UpdateOptions = {}): TSelf {
        const next = applyPatch(this.data, patch);
        if (options.validate !== false) {
            validateJsCalendarObject(next);
        }
        const touched = this.touchFromPatch(next, patch, options);
        return this.wrap(touched);
    }

    /**
     * Update updated/sequence metadata for modified keys.
     * @param keys Modified keys.
     * @param options Update options.
     * @return Updated instance.
     */
    protected touchKeys(
        data: T,
        keys: string[],
        options: UpdateOptions = {},
    ): T {
        if (options.touch === false) return data;
        const now = options.now ?? nowUtc;
        data.updated = now();
        if (options.sequence === false) return data;
        const current = isNumberValue(data.sequence) ? data.sequence : 0;
        data.sequence = current + 1;
        return data;
    }

    /**
     * Update updated/sequence metadata for PatchObject changes.
     * @param patch Patch applied to the object.
     * @param options Update options.
     * @return Updated instance.
     */
    protected touchFromPatch(
        data: T,
        patch: PatchLike,
        options: UpdateOptions = {},
    ): T {
        if (options.touch === false) return data;
        const now = options.now ?? nowUtc;
        data.updated = now();
        if (options.sequence === false) return data;
        const current = isNumberValue(data.sequence) ? data.sequence : 0;
        data.sequence = current + 1;
        return data;
    }
}
