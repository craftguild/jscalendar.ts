import { describe, expect, it } from "vitest";
import {
  compareDateTime,
  dateTimeInTimeZone,
  deepClone,
  durationToMilliseconds,
  isUtcDateTime,
  localDateTimeFromDate,
  localDateTimeToUtcDate,
  normalizeUtcDateTime,
} from "../utils.js";
import { JsCal } from "../jscal.js";

describe("utils", () => {
  it("detects UTC date-time", () => {
    expect(isUtcDateTime("2026-02-01T00:00:00Z")).toBe(true);
    expect(isUtcDateTime("2026-02-01T00:00:00")).toBe(false);
  });

  it("normalizes UTC date-time", () => {
    expect(normalizeUtcDateTime("2026-02-01T00:00:00.000Z")).toBe("2026-02-01T00:00:00Z");
  });

  it("formats local date-time from Date", () => {
    const value = localDateTimeFromDate(new Date("2026-02-01T10:00:00Z"));
    expect(value).toMatch(/^2026-02-01T/);
  });

  it("formats date-time in time zone", () => {
    const value = dateTimeInTimeZone(new Date("2026-02-01T10:00:00Z"), "UTC");
    expect(value).toBe("2026-02-01T10:00:00");
  });

  it("rejects invalid LocalDateTime in time zone conversion", () => {
    expect(() => localDateTimeToUtcDate("invalid", "Asia/Tokyo")).toThrow();
  });

  it("compares UTC date-times", () => {
    expect(compareDateTime("2026-02-01T00:00:00Z", "2026-02-01T00:00:00Z")).toBe(0);
    expect(compareDateTime("2026-02-01T00:00:00Z", "2026-02-01T01:00:00Z")).toBe(-1);
    expect(compareDateTime("2026-02-01T01:00:00Z", "2026-02-01T00:00:00Z")).toBe(1);
  });

  it("returns null for invalid UTC date-times", () => {
    expect(compareDateTime("2026-99-99T00:00:00Z", "2026-02-01T00:00:00Z")).toBeNull();
  });

  it("compares local date-times lexicographically", () => {
    expect(compareDateTime("2026-02-01T00:00:00", "2026-02-01T00:00:00")).toBe(0);
    expect(compareDateTime("2026-02-01T00:00:00", "2026-02-02T00:00:00")).toBe(-1);
  });

  it("returns null when comparing mixed UTC/local", () => {
    expect(compareDateTime("2026-02-01T00:00:00", "2026-02-01T00:00:00Z")).toBeNull();
  });

  it("parses durations", () => {
    expect(durationToMilliseconds("PT1H")).toBe(60 * 60 * 1000);
    expect(durationToMilliseconds("P1DT30M")).toBe(24 * 60 * 60 * 1000 + 30 * 60 * 1000);
  });

  it("rejects invalid durations", () => {
    expect(durationToMilliseconds("invalid")).toBeNull();
  });

  it("builds duration strings", () => {
    expect(JsCal.duration.seconds(90)).toBe("PT1M30S");
    expect(JsCal.duration.minutes(90)).toBe("PT1H30M");
    expect(JsCal.duration.hours(1)).toBe("PT1H");
    expect(JsCal.duration.days(1)).toBe("P1D");
    expect(JsCal.duration.from({ hours: 1, minutes: 15 })).toBe("PT1H15M");
  });

  it("creates base64url ids", () => {
    const id = JsCal.createId();
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("falls back to random bytes when randomUUID is unavailable", () => {
    const original = globalThis.crypto;
    const fakeCrypto = {
      getRandomValues(values: Uint8Array): Uint8Array {
        for (let i = 0; i < values.length; i += 1) {
          values[i] = i & 0xff;
        }
        return values;
      },
    };
    Object.defineProperty(globalThis, "crypto", {
      value: fakeCrypto,
      configurable: true,
    });
    try {
      const uid = JsCal.createUid();
      expect(uid).toMatch(/^[0-9a-f-]+$/);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        value: original,
        configurable: true,
      });
    }
  });

  it("uses Math.random fallback when crypto is missing", () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
    });
    try {
      const id = JsCal.createId();
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        value: original,
        configurable: true,
      });
    }
  });

  it("resolves time zones", () => {
    const tz = JsCal.timeZone("asia/tokyo");
    expect(tz).toBe("Asia/Tokyo");
    expect(JsCal.timeZones.includes("Asia/Tokyo")).toBe(true);
  });

  it("throws when structuredClone is unavailable", () => {
    const original = globalThis.structuredClone;
    Object.defineProperty(globalThis, "structuredClone", {
      value: undefined,
      configurable: true,
    });
    try {
      expect(() => deepClone({ value: 1 })).toThrow();
    } finally {
      Object.defineProperty(globalThis, "structuredClone", {
        value: original,
        configurable: true,
      });
    }
  });
});
