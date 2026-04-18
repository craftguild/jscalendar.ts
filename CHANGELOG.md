# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.7.2](https://github.com/craftguild/jscalendar.ts/compare/v0.7.1...v0.7.2) (2026-04-18)

## [0.7.1](https://github.com/craftguild/jscalendar.ts/compare/v0.7.0...v0.7.1) (2026-04-18)

### Bug Fixes

- fold iCalendar lines by UTF-8 octet length ([a5b9eeb](https://github.com/craftguild/jscalendar.ts/commit/a5b9eeb49c0f5a01840ad475a91399fda515e8c2))

## 0.7.0

- Feature: switch patch updates to RFC 6902 JSON Patch.
- Feature: add JSCalendar diff helpers.
- Feature: add Zod validation helpers.
- Docs: refine README examples for patching, diffing, validation, and recurrence expansion.

## 0.6.0

- Feature: add `includeAnchor` option to recurrence expansion.
- Tests: expand recurrence coverage for anchor inclusion and exclusion behavior.
- Docs: document `includeAnchor` usage in README and browser demo.

## 0.5.6

- Feature: expand time zone support with regional IANA zones and resolver helpers.
- Feature: add a browser demo for recurrence and iCalendar export.
- Tests: add default-value and validation-internals coverage.
- Docs: update README examples for browser usage and time zone support.

## 0.5.5

- Fix: allow `expandRecurrencePaged` cursor to accept `undefined` under `exactOptionalPropertyTypes`.
- Fix: restore `TimeZoneId` type import to resolve build errors.
- Chore: align `@ts-expect-error` placement in search tests.
- Chore: update pre-commit hook to run lint-staged, build, tsdown, and tests.

## 0.5.4

- Fix: export timezone types as type-only to avoid tsdown warnings.
- Build: publish dual ESM/CJS exports with conditional type definitions.
- Chore: configure Prettier for 4-space indentation using spaces.

## 0.5.2

- Docs: refresh the README logo asset and constrain display height.

## 0.5.3

- Docs: adjust README logo markup to center the image and use a fixed height.

## 0.5.1

- Docs: refine README Quick Start and patch usage examples.

## 0.5.0

- Breaking: remove `update` API; use `patch` for updates.
- Breaking: remove `addLocation/addVirtualLocation/addParticipant/addAlert` helpers; use `patch` for nested updates.
- Breaking: make JsCal id-map helpers accept only `{ id?, value }` entries.
- Feature: expose `JsCal.isEvent/isTask/isGroup` and `JsCal.ByDay` alias.
- Feature: add `EventPatch/TaskPatch/GroupPatch` helpers and typed patch maps.
- Feature: sort `expandRecurrence` output by recurrence id/start.
- Docs/Tests: update Quick Start, add sorted recurrence test, and align tests with immutable API.

## 0.4.1

- Fix: enforce required participant roles and reject empty role sets.
- Docs/Tests: update README examples and add validation coverage for roles.

## 0.4.0

- Feature: add OffsetTrigger/AbsoluteTrigger builders for alert triggers.
- Feature: allow signed values in duration helpers for signed duration use cases.
- Fix: clamp negative numeric event durations to zero when normalizing.
- Docs/Tests: update README examples and expand builder/duration tests.

## 0.3.1

- Chore: remove local `main.ts` playground file.

## 0.3.0

- Feature: add builder helpers with strict validation and id-map utilities.
- Refactor: split large files into modular `jscal`, `recurrence`, and `validate` directories.
- Docs/Tests: expand README and test coverage.

## 0.2.0

- Docs: clarify group entries and document `eject()` behavior.
- Docs: update README.
- Tests: add coverage for documentation changes.

## 0.1.0

- Initial release.
