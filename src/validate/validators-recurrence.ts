import type { NDay, PatchObject, RecurrenceRule } from "../types.js";
import { fail } from "./error.js";
import { DAY_OF_WEEK, RECURRENCE_FREQUENCY, RSCALE_GREGORIAN, SKIP, TYPE_NDAY, TYPE_RECURRENCE_RULE } from "./constants.js";
import { assertBooleanMap, assertInteger, assertLocalDateTime, assertSignedDuration, assertString, assertUnsignedInt } from "./asserts.js";
import { isNumberValue, isStringValue } from "../utils.js";

/**
 * Validate n day structure.
 * @param value NDay object to validate.
 * @param path JSON pointer path for error messages.
 * @return Nothing.
 */
export function validateNDay(value: NDay, path: string): void {
  if (value["@type"] !== TYPE_NDAY) fail(path, "must have @type NDay");
  if (!DAY_OF_WEEK.has(value.day)) fail(`${path}.day`, "must be a valid day of week");
  assertInteger(value.nthOfPeriod, `${path}.nthOfPeriod`);
}

/**
 * Validate recurrence rule structure.
 * @param value RecurrenceRule object to validate.
 * @param path JSON pointer path for error messages.
 * @return Nothing.
 */
export function validateRecurrenceRule(value: RecurrenceRule, path: string): void {
  if (value["@type"] !== TYPE_RECURRENCE_RULE) fail(path, "must have @type RecurrenceRule");
  if (!RECURRENCE_FREQUENCY.has(value.frequency)) fail(`${path}.frequency`, "must be a valid frequency");
  assertUnsignedInt(value.interval, `${path}.interval`);
  assertUnsignedInt(value.count, `${path}.count`);
  if (value.rscale !== undefined && value.rscale !== RSCALE_GREGORIAN) {
    fail(`${path}.rscale`, "only gregorian is supported");
  }
  if (value.skip !== undefined && !SKIP.has(value.skip)) fail(`${path}.skip`, "must be omit, backward, or forward");
  if (value.firstDayOfWeek !== undefined && !DAY_OF_WEEK.has(value.firstDayOfWeek)) {
    fail(`${path}.firstDayOfWeek`, "must be a valid day of week");
  }
  if (value.byDay) {
    for (let i = 0; i < value.byDay.length; i += 1) {
      const entry = value.byDay[i];
      if (!entry) continue;
      validateNDay(entry, `${path}.byDay[${i}]`);
    }
  }
  if (value.byMonthDay) {
    for (let i = 0; i < value.byMonthDay.length; i += 1) {
      const entry = value.byMonthDay[i];
      if (!isNumberValue(entry) || !Number.isInteger(entry) || entry === 0 || entry < -31 || entry > 31) {
        fail(`${path}.byMonthDay[${i}]`, "must be an integer between -31 and 31, excluding 0");
      }
    }
  }
  if (value.byMonth) {
    for (let i = 0; i < value.byMonth.length; i += 1) {
      const entry = value.byMonth[i];
      if (!isStringValue(entry)) fail(`${path}.byMonth[${i}]`, "must be a string month");
      const numeric = Number.parseInt(entry, 10);
      if (!Number.isInteger(numeric) || numeric < 1 || numeric > 12) {
        fail(`${path}.byMonth[${i}]`, "must be a month number between 1 and 12");
      }
    }
  }
  if (value.byYearDay) {
    for (let i = 0; i < value.byYearDay.length; i += 1) {
      const entry = value.byYearDay[i];
      if (!isNumberValue(entry) || !Number.isInteger(entry) || entry === 0 || entry < -366 || entry > 366) {
        fail(`${path}.byYearDay[${i}]`, "must be an integer between -366 and 366, excluding 0");
      }
    }
  }
  if (value.byWeekNo) {
    for (let i = 0; i < value.byWeekNo.length; i += 1) {
      const entry = value.byWeekNo[i];
      if (!isNumberValue(entry) || !Number.isInteger(entry) || entry === 0 || entry < -53 || entry > 53) {
        fail(`${path}.byWeekNo[${i}]`, "must be an integer between -53 and 53, excluding 0");
      }
    }
  }
  if (value.byHour) {
    for (let i = 0; i < value.byHour.length; i += 1) {
      const entry = value.byHour[i];
      if (!isNumberValue(entry) || !Number.isInteger(entry) || entry < 0 || entry > 23) {
        fail(`${path}.byHour[${i}]`, "must be an integer between 0 and 23");
      }
    }
  }
  if (value.byMinute) {
    for (let i = 0; i < value.byMinute.length; i += 1) {
      const entry = value.byMinute[i];
      if (!isNumberValue(entry) || !Number.isInteger(entry) || entry < 0 || entry > 59) {
        fail(`${path}.byMinute[${i}]`, "must be an integer between 0 and 59");
      }
    }
  }
  if (value.bySecond) {
    for (let i = 0; i < value.bySecond.length; i += 1) {
      const entry = value.bySecond[i];
      if (!isNumberValue(entry) || !Number.isInteger(entry) || entry < 0 || entry > 59) {
        fail(`${path}.bySecond[${i}]`, "must be an integer between 0 and 59");
      }
    }
  }
  if (value.bySetPosition) {
    for (let i = 0; i < value.bySetPosition.length; i += 1) {
      const entry = value.bySetPosition[i];
      if (!isNumberValue(entry) || !Number.isInteger(entry) || entry === 0) {
        fail(`${path}.bySetPosition[${i}]`, "must be a non-zero integer");
      }
    }
  }
  assertLocalDateTime(value.until, `${path}.until`);
}
