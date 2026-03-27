import { describe, expect, it } from "vitest";
import { JsCal } from "../jscal.js";
import {
    EtcTimeZones,
    GmtTimeZones,
    RegionalTimeZones,
    resolveTimeZone,
    TimeZones,
} from "../timezones.js";

describe("time zones", () => {
    it("resolves Etc/UTC", () => {
        expect(resolveTimeZone("Etc/UTC")).toBe("Etc/UTC");
    });

    it("resolves lowercase inputs", () => {
        expect(resolveTimeZone("asia/tokyo")).toBe("Asia/Tokyo");
    });

    it("merges regional, Etc, and GMT lists", () => {
        expect(RegionalTimeZones.includes("Asia/Tokyo")).toBe(true);
        expect(EtcTimeZones.includes("Etc/UTC")).toBe(true);
        expect(GmtTimeZones.includes("GMT")).toBe(true);
        expect(TimeZones.includes("Asia/Tokyo")).toBe(true);
        expect(TimeZones.includes("Etc/UTC")).toBe(true);
        expect(TimeZones.includes("GMT")).toBe(true);
    });

    it("throws on unknown time zones", () => {
        // @ts-expect-error invalid time zone input
        expect(() => JsCal.timeZone("Invalid/Zone")).toThrow();
        // @ts-expect-error invalid time zone input
        expect(() => JsCal.timeZone("UTC")).toThrow();
    });
});
