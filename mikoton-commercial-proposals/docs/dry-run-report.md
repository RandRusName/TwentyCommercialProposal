# Dry Run Report

Date: 2026-07-12.

## Local Build Dry Run

Command:

```powershell
yarn.cmd twenty dev:build .
```

Result:

- manifest built;
- front component and logic functions built;
- SDK typecheck passed;
- no manifest warnings after default value fixes.

## Remote Plan

Attempted non-destructive remote authentication:

```powershell
yarn.cmd twenty remote:add --as mikoton-remote --url http://192.168.100.11:3000
```

Observed result:

- CLI attempted browser auth;
- server responded: `Server does not expose a CLI client ID`;
- CLI requested API key;
- no credentials were invented or supplied.

Attempted plan against existing `local` remote:

```powershell
yarn.cmd twenty plan -r local .
```

Observed result:

- existing `local` remote points to `http://localhost:2020`;
- server unreachable;
- no remote metadata was changed.

## Conclusion

Remote dry-run against `http://192.168.100.11:3000` is blocked until a real API
key is provided.

No `apply` command was executed.
