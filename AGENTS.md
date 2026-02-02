# Agent Notes: jscalendar library

## Project intent
- Thin JSCalendar (RFC 8984) data model helpers with better DX.
- Internal representation stays RFC-compliant strings.
- Exports only `JsCal` from `src/index.ts`.

## Key API
- `new JsCal.Event(...)`, `new JsCal.Task(...)`, `new JsCal.Group(...)`.
- `eject()` returns JSON-compatible object (replaces `toJSON`).
- `JsCal.toICal([...])` **requires array input**.
- `JsCal.filterByText([...])` and other search helpers accept arrays of JSCalendar objects **or** JsCal instances.
- `JsCal.filterByDateRange([...], { start?, end? })` accepts `string | Date` for range values.
- `JsCal.duration.*` for ISO8601 duration strings.
- `JsCal.timeZone("asia/tokyo") -> "Asia/Tokyo"`, `JsCal.timeZones` list.

## Defaults (RFC-defined only)
- Common: `sequence=0`, `title=""`, `description=""`, `descriptionContentType="text/plain"`,
  `showWithoutTime=false`, `recurrenceIdTimeZone=null`, `excluded=false`, `priority=0`,
  `freeBusyStatus="busy"`, `privacy="public"`, `useDefaultAlerts=false`.
- Event: `duration="PT0S"`, `status="confirmed"`.
- Task: `progress` computed from participants (or `needs-action`).
- Participant: `participationStatus="needs-action"`, `expectReply=false`, `scheduleAgent="server"`,
  `scheduleForceSend=false`, `scheduleSequence=0`.
- Alert: `action="display"`, `OffsetTrigger.relativeTo="start"`.
- VirtualLocation: `name=""`.
- `created` is set to `updated` if missing. `updated` always set.
- `timeZone` is **not** auto-filled (RFC default is null/omitted). Explicitly set or omit.

## Time zone list
- `src/timezones.ts` generated list (424 IANA zones).
- `TimeZoneId` is a union of those literals.
- `TimeZoneInput = TimeZoneId | Lowercase<TimeZoneId>`.

## Date/time handling
- Uses `date-fns` + `date-fns-tz` in `src/utils.ts`.
- `localDateTimeFromDate` converts Date -> local datetime string.
- `dateTimeInTimeZone` converts Date -> local datetime string in a target timeZone.
- `localDateTimeToUtcDate` converts LocalDateTime + timeZone -> UTC Date.
- If filter range values are `Date`, range comparisons use Date-based logic with timeZone-aware conversion.
- Recurrence expansion compares ranges using timeZone-aware conversion when `timeZone` is present.

## Notable constraints
- No `node:` deps; browser-friendly.
- No `as` casts or `unknown` usage in src.
- `toICal` input is array only.
 - RSCALE is gregorian-only; non-gregorian is rejected (documented in README).

## Build/test
- `pnpm run build` (tsc)
- `pnpm test`

## Files
- `src/jscal.ts` main API
- `src/ical.ts` iCalendar export
- `src/recurrence.ts` recurrence expansion + paging helpers
- `src/timezones.ts` generated list & resolver
- `README.md` usage/examples
- Tests in `src/__tests__`

## Refactoring rules
- Keep public method signatures unchanged.
- Add JSDoc in English for every method/function with `@param`/`@return`.
- JSDoc summaries should describe the behavior, not just say “helper”.
- Fix JSDoc formatting (asterisk alignment, line breaks) when touched.
- Avoid bulk/automatic JSDoc rewrites; review each file manually.
- Prefer small methods (~15 lines) and split when practical.
- When splitting creates duplicate logic, consolidate into `utils` or shared libs.
- When comparing string values to literals, define a constant and compare against it.
- Keep files around 250–400 lines where practical; `src/timezones.ts` may remain a single file.
