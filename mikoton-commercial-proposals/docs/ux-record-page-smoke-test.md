# Commercial Proposal Record Page UX Validation

## Build Under Test

- Target: `http://192.168.100.11:3000`
- Twenty: `v2.20.0`
- App version: pending deployment
- Commit: pending deployment
- Date: 2026-07-21

## Automated Validation

| Check | Result | Evidence |
|---|---|---|
| Typecheck | Passed | WSL `corepack yarn typecheck` |
| Unit tests | Passed | 115 tests before final documentation update |
| Manifest build | Passed | `corepack yarn twenty dev:build .`; 14 files built |
| Record page metadata | Passed | Home front component plus Timeline, Tasks, Notes and Files; no `FIELDS` widget |
| Default list navigation | Passed | metadata test asserts `ViewOpenRecordIn.RECORD_PAGE` |
| New draft defaults | Passed | domain tests assert `AGGREGATE_V2`, `amount = 0`, `number = Черновик` |
| Empty v2 save | Passed | domain test confirms canonical `amount = 0` |

## Target Validation

Target metadata plan, deployment and browser smoke have not yet been executed for
this change set. Results must be written here after the real run; no target item
is marked passed in advance.
