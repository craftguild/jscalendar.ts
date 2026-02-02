import type { RecurrenceRule } from "../types.js";
import { FREQ_HOURLY, FREQ_MINUTELY, FREQ_MONTHLY, FREQ_SECONDLY, FREQ_WEEKLY, FREQ_YEARLY } from "./constants.js";
import type { DateTime } from "./types.js";
import { dayOfWeek } from "./date-utils.js";

/**
 * Normalize rule fields by copying arrays and filling defaults from the start date-time.
 * @param rule Recurrence rule to normalize.
 * @param start Anchor date-time that supplies default by* values.
 * @return Normalized recurrence rule with default by* fields filled.
 */
export function normalizeRule(rule: RecurrenceRule, start: DateTime): RecurrenceRule {
  const normalized: RecurrenceRule = {
    ...rule,
    bySecond: rule.bySecond ? [...rule.bySecond] : undefined,
    byMinute: rule.byMinute ? [...rule.byMinute] : undefined,
    byHour: rule.byHour ? [...rule.byHour] : undefined,
    byDay: rule.byDay ? [...rule.byDay] : undefined,
    byMonthDay: rule.byMonthDay ? [...rule.byMonthDay] : undefined,
    byMonth: rule.byMonth ? [...rule.byMonth] : undefined,
    byYearDay: rule.byYearDay ? [...rule.byYearDay] : undefined,
    byWeekNo: rule.byWeekNo ? [...rule.byWeekNo] : undefined,
    bySetPosition: rule.bySetPosition ? [...rule.bySetPosition] : undefined,
  };

  if (normalized.frequency !== FREQ_SECONDLY && (!normalized.bySecond || normalized.bySecond.length === 0)) {
    normalized.bySecond = [start.second];
  }
  if (normalized.frequency !== FREQ_SECONDLY && normalized.frequency !== FREQ_MINUTELY &&
    (!normalized.byMinute || normalized.byMinute.length === 0)) {
    normalized.byMinute = [start.minute];
  }
  if (normalized.frequency !== FREQ_SECONDLY && normalized.frequency !== FREQ_MINUTELY &&
    normalized.frequency !== FREQ_HOURLY &&
    (!normalized.byHour || normalized.byHour.length === 0)) {
    normalized.byHour = [start.hour];
  }

  if (normalized.frequency === FREQ_WEEKLY && (!normalized.byDay || normalized.byDay.length === 0)) {
    normalized.byDay = [{ "@type": "NDay", day: dayOfWeek(start) }];
  }

  if (normalized.frequency === FREQ_MONTHLY && (!normalized.byDay || normalized.byDay.length === 0) &&
    (!normalized.byMonthDay || normalized.byMonthDay.length === 0)) {
    normalized.byMonthDay = [start.day];
  }

  if (normalized.frequency === FREQ_YEARLY && (!normalized.byYearDay || normalized.byYearDay.length === 0)) {
    const hasByMonth = normalized.byMonth && normalized.byMonth.length > 0;
    const hasByWeekNo = normalized.byWeekNo && normalized.byWeekNo.length > 0;
    const hasByMonthDay = normalized.byMonthDay && normalized.byMonthDay.length > 0;
    const hasByDay = normalized.byDay && normalized.byDay.length > 0;

    if (!hasByMonth && !hasByWeekNo && (hasByMonthDay || !hasByDay)) {
      normalized.byMonth = [start.month.toString()];
    }

    if (!hasByMonthDay && !hasByWeekNo && !hasByDay) {
      normalized.byMonthDay = [start.day];
    }

    if (hasByWeekNo && !hasByMonthDay && !hasByDay) {
      normalized.byDay = [{ "@type": "NDay", day: dayOfWeek(start) }];
    }
  }

  return normalized;
}
