import type { JSCalendarObject } from "../types.js";
import { deepClone, isNumberValue, nowUtc } from "../utils.js";
import { validateJsCalendarObject } from "../validate.js";
import { assertJsCalendarObject } from "../validate/asserts.js";
import { fail } from "../validate/error.js";
import type { UpdateOptions } from "./types.js";
import { applyPatch as applyJsonPatch } from "json-joy/lib/json-patch/index.js";
import type { JsonPatchOperation } from "json-joy/lib/json-patch/types.js";

export abstract class Base<
    T extends JSCalendarObject,
    TSelf extends Base<T, TSelf>,
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
     * Apply a JSON Patch document and touch updated/sequence metadata.
     * @param patch Patch to apply.
     * @param options Update options.
     * @return New instance with applied patch.
     */

    patch(
        patch: readonly JsonPatchOperation[],
        options: UpdateOptions = {},
    ): TSelf {
        const result = applyJsonPatch(this.data, patch, { mutate: false });
        const next: unknown = result.doc;
        assertJsCalendarObject(next);
        this.assertSameType(next);
        if (options.validate !== false) {
            validateJsCalendarObject(next);
        }
        const touched = this.touchFromPatch(next, options);
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
     * Update updated/sequence metadata after patch.
     * @param data Patched data.
     * @param options Update options.
     * @return Updated instance.
     */
    protected touchFromPatch(data: T, options: UpdateOptions = {}): T {
        if (options.touch === false) return data;
        const now = options.now ?? nowUtc;
        data.updated = now();
        if (options.sequence === false) return data;
        const current = isNumberValue(data.sequence) ? data.sequence : 0;
        data.sequence = current + 1;
        return data;
    }

    /**
     * Assert patched object type is unchanged.
     * @param value Patched JSCalendar object.
     * @return Nothing.
     */
    protected assertSameType(value: JSCalendarObject): asserts value is T {
        if (value["@type"] !== this.data["@type"]) {
            fail('object["@type"]', `must remain ${this.data["@type"]}`);
        }
    }
}
