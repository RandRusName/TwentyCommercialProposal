# Twenty Compatibility Policy

| Component | Supported version |
|---|---|
| Twenty Server | `>=2.20.0 <2.21.0` (validated on `v2.20.0`) |
| `twenty-sdk` | exactly `2.20.0` |
| `twenty-client-sdk` | exactly `2.20.0` |
| Node.js | `^24.5.0` |
| App | current package SemVer |
| Document-service contract | schema `1.0` and `2.0` compatibility |
| Metadata schema | Phase `5.5` baseline |

Support is not widened without CI against the candidate Twenty image, tarball
build validation, metadata plan, upgrade rehearsal and target/UAT smoke.

An unsupported Twenty version must stop deployment before publish/install.
Patch upgrades within a tested range still require CI and a repeated metadata
plan. Minor/major Twenty upgrades require a compatibility branch and explicit
acceptance. Universal identifiers are immutable across compatible releases.
