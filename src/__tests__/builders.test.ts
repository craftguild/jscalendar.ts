import { describe, expect, it } from "vitest";
import { JsCal } from "../jscal.js";
import {
  buildAbsoluteTrigger,
  buildAlert,
  buildIdMap,
  buildLink,
  buildLocation,
  buildNDay,
  buildOffsetTrigger,
  buildRecurrenceRule,
  buildRelation,
  buildTimeZone,
  buildTimeZoneMap,
  buildTimeZoneRule,
  buildVirtualLocation,
} from "../jscal/builders.js";

describe("builders", () => {
  it("builds strict objects with @type", () => {
    const participant = JsCal.Participant({ name: "Alice", roles: { attendee: true } });
    const location = buildLocation({ name: "Room A" });
    const vloc = buildVirtualLocation({ name: "Zoom", uri: "https://example.com" });
    const link = buildLink({ href: "https://example.com" });
    const relation = buildRelation({ relation: { parent: true } });
    const alert = buildAlert({ trigger: buildOffsetTrigger({ offset: JsCal.duration.minutes(-15) }) });
    const absoluteTrigger = buildAbsoluteTrigger({ when: "2026-02-01T00:00:00Z" });
    const nday = buildNDay({ day: "mo" });
    const rule = buildRecurrenceRule({ frequency: "daily" });
    const tzRule = buildTimeZoneRule({
      start: "2026-01-01T00:00:00",
      offsetFrom: "+09:00",
      offsetTo: "+09:00",
    });
    const tz = buildTimeZone({
      tzId: "Asia/Tokyo",
      standard: [tzRule],
    });

    expect(participant["@type"]).toBe("Participant");
    expect(location["@type"]).toBe("Location");
    expect(vloc["@type"]).toBe("VirtualLocation");
    expect(link["@type"]).toBe("Link");
    expect(relation["@type"]).toBe("Relation");
    expect(alert["@type"]).toBe("Alert");
    expect(absoluteTrigger["@type"]).toBe("AbsoluteTrigger");
    expect(nday["@type"]).toBe("NDay");
    expect(rule["@type"]).toBe("RecurrenceRule");
    expect(tz["@type"]).toBe("TimeZone");
  });

  it("builds id maps with generated ids", () => {
    const participants = JsCal.participants([
      { name: "Alice", roles: { attendee: true } },
      { name: "Bob", roles: { attendee: true } },
    ]);
    expect(Object.keys(participants).length).toBe(2);

    const locations = JsCal.locations([{ name: "Room A" }]);
    expect(Object.keys(locations).length).toBe(1);

    const links = JsCal.links([{ href: "https://example.com" }]);
    expect(Object.keys(links).length).toBe(1);

    const related = JsCal.relatedTo([{ relation: { parent: true } }]);
    expect(Object.keys(related).length).toBe(1);
  });

  it("builds a time zone map keyed by tzId", () => {
    const map = buildTimeZoneMap([
      { tzId: "Asia/Tokyo", standard: [{ "@type": "TimeZoneRule", start: "2026-01-01T00:00:00", offsetFrom: "+09:00", offsetTo: "+09:00" }] },
    ]);
    expect(map["Asia/Tokyo"]?.tzId).toBe("Asia/Tokyo");
  });

  it("buildIdMap uses a custom id function", () => {
    const map = buildIdMap([{ name: "A" }], (item) => item, (_item, index) => `id-${index}`);
    expect(Object.keys(map)).toEqual(["id-0"]);
  });

  it("throws when @type mismatches", () => {
    // Intentionally bypass type safety to assert @type validation errors.
    const bad = { "@type": "Location" } as unknown as Parameters<typeof JsCal.Participant>[0];
    expect(() => JsCal.Participant(bad)).toThrowError("participant: must have @type Participant");
  });

  it("throws for mismatched @type across builders", () => {
    // Intentionally bypass type safety to assert @type validation errors.
    expect(() => buildLocation({ "@type": "Participant" } as unknown as Parameters<typeof buildLocation>[0]))
      .toThrowError("location: must have @type Location");
    expect(() => buildVirtualLocation({ "@type": "Location" } as unknown as Parameters<typeof buildVirtualLocation>[0]))
      .toThrowError("virtualLocation: must have @type VirtualLocation");
    expect(() => buildAlert({ "@type": "Link" } as unknown as Parameters<typeof buildAlert>[0]))
      .toThrowError("alert: must have @type Alert");
    expect(() => buildOffsetTrigger({ "@type": "Alert" } as unknown as Parameters<typeof buildOffsetTrigger>[0]))
      .toThrowError("offsetTrigger: must have @type OffsetTrigger");
    expect(() => buildAbsoluteTrigger({ "@type": "Alert" } as unknown as Parameters<typeof buildAbsoluteTrigger>[0]))
      .toThrowError("absoluteTrigger: must have @type AbsoluteTrigger");
    expect(() => buildRelation({ "@type": "Link" } as unknown as Parameters<typeof buildRelation>[0]))
      .toThrowError("relation: must have @type Relation");
    expect(() => buildLink({ "@type": "Relation" } as unknown as Parameters<typeof buildLink>[0]))
      .toThrowError("link: must have @type Link");
    expect(() => buildTimeZone({ "@type": "Alert" } as unknown as Parameters<typeof buildTimeZone>[0]))
      .toThrowError("timeZone: must have @type TimeZone");
    expect(() => buildTimeZoneRule({ "@type": "TimeZone" } as unknown as Parameters<typeof buildTimeZoneRule>[0]))
      .toThrowError("timeZoneRule: must have @type TimeZoneRule");
    expect(() => buildRecurrenceRule({ "@type": "NDay" } as unknown as Parameters<typeof buildRecurrenceRule>[0]))
      .toThrowError("recurrenceRule: must have @type RecurrenceRule");
    expect(() => buildNDay({ "@type": "RecurrenceRule" } as unknown as Parameters<typeof buildNDay>[0]))
      .toThrowError("nday: must have @type NDay");
  });
});
