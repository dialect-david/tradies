# Add login

Users can sign in.

Depends on: remove-legacy, `old-thing`

## Why

Nobody can sign in yet, so nothing is personal.

Sessions were ripped out with the legacy auth and never replaced.

## What Changes

- a session table
- a login route and form

## Impact

Touches `auth` and the UI shell.

## Open questions

- [ ] magic links too?
- [x] which hash
