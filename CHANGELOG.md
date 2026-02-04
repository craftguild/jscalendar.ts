# Changelog

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
