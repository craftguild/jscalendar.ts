import { Temporal as PolyfillTemporal } from "@js-temporal/polyfill";
import type { Temporal as PolyfillTemporalTypes } from "@js-temporal/polyfill";

type TemporalModule = typeof PolyfillTemporal;

const globalTemporal = globalThis as typeof globalThis & {
    Temporal?: TemporalModule;
};

export const Temporal: TemporalModule =
    globalTemporal.Temporal ?? PolyfillTemporal;

export type PlainDate = PolyfillTemporalTypes.PlainDate;
export type PlainDateTime = PolyfillTemporalTypes.PlainDateTime;
export type ZonedDateTime = PolyfillTemporalTypes.ZonedDateTime;
export type DurationLike = PolyfillTemporalTypes.DurationLike;
