# Stage 17A — Authentication, Cloud Saves, Profiles, and Verified Leaderboards

## AI execution mode

**Primary AI role:** Auth/Persistence Agent with Lead Integrator and QA/Red-Team review.

This stage is executed under `docs/ai/AI_EXECUTION_CONTRACT.md` and `docs/backend/AUTH_LEADERBOARDS.md`. The worker must implement a local/self-hostable path first, prove that guest play still works with all cloud services disconnected, and refuse any design that stores plaintext credentials or lets the browser author competitive scores.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`, plus TDD and verification-before-completion.

**Goal:** Add optional accounts, secure persistence, Google-preferred/email-fallback authentication, cloud-save abstraction, public profiles, and a verified seeded-challenge leaderboard without making account creation mandatory for first play.

**Architecture:** Better Auth is the canonical self-hosted TypeScript auth layer. SQLite is allowed for the first local vertical slice; PostgreSQL becomes the persistence target before a public leaderboard. Google OAuth is an adapter. Email/password or magic-link is a fallback. A hosted service such as Supabase is an optional adapter only after current terms/card/account constraints are verified. Competitive leaderboard records are written from trusted authoritative server logic, never directly by clients.

**Tech Stack:** TypeScript, Better Auth, SQLite/PostgreSQL, Mailpit for local email testing, existing server/protocol packages, Vitest/Playwright.

**Spec:** `docs/backend/AUTH_LEADERBOARDS.md`

## Global Constraints

- guest play must work offline/local without account
- Google is preferred public sign-in, email is fallback
- no plaintext passwords
- no password in browser localStorage/IndexedDB
- no Google client secret or admin/service key in browser bundle
- account/email never displayed on leaderboard
- client cannot directly insert verified leaderboard results
- free/no-card/no-adult-only critical path remains intact
- cloud provider is an adapter, not the product architecture

## Review Focus

1. Guest-first flow remains fast.
2. Secret handling and session storage are safe.
3. Guest-to-account migration is idempotent and rollback-safe.
4. Leaderboard writes are tied to authoritative verified match results.
5. Local/self-hosted development works when every cloud adapter is disabled.

## Planned File Map

```text
apps/server/src/auth/
apps/server/src/persistence/
apps/server/src/leaderboard/
apps/web/src/auth/
apps/web/src/screens/auth/
apps/web/src/screens/leaderboard/
packages/protocol/src/auth.ts
packages/protocol/src/leaderboard.ts
packages/progression/src/save-schema.ts
packages/telemetry/src/account-events.ts
tools/security/
docs/backend/AUTH_LEADERBOARDS.md
docs/gates/STAGE-17A-GATE.md
```

## Implementation Task Sequence

- [ ] **Task 1: contracts first.** Write protocol/save/auth/leaderboard schemas and failing tests for guest identity, account identity, cloud-save revisions, match result IDs, leaderboard sorting, and idempotency.
- [ ] **Task 2: local Better Auth vertical slice.** Configure local SQLite auth, generated secret from environment, sessions, email/password, and protected test route. Keep all secrets out of Git.
- [ ] **Task 3: local email testing.** Integrate Mailpit or an equivalent local SMTP sink; test verification and reset flows without external email service.
- [ ] **Task 4: Google adapter interface.** Implement provider configuration behind environment variables and test adapter selection. Do not make Google credentials necessary for local CI.
- [ ] **Task 5: guest save.** Implement versioned local guest profile/save and deterministic checksum/revision.
- [ ] **Task 6: account persistence.** Implement PostgreSQL-compatible storage interfaces and migrations for profile, progress, match result, challenge result, season, and replay references.
- [ ] **Task 7: guest linking.** Write conflict/rollback tests, then implement guest-to-account progress merge with read-back verification.
- [ ] **Task 8: authoritative result writer.** Trusted server finalizes result + replay hash and writes an idempotent verified result transaction.
- [ ] **Task 9: leaderboard query.** Implement Daily, Weekly, Road-to-Legend categories with deterministic tie-break ordering, Top 100, and Around Me.
- [ ] **Task 10: UI.** Implement guest/Google/email entry, profile, account-link flow, cloud-save state, and leaderboard screens against DESIGN.md.
- [ ] **Task 11: attack tests.** Attempt direct browser insert, replay-hash mismatch, duplicate result, impossible time/score, stale build version, stolen/invalid session, and display-name abuse.
- [ ] **Task 12: hosted adapter gate.** If Supabase or another provider is desired, re-check current price/card/account/age terms and document PASS/FAIL. The stage passes without hosted adoption.

## Tests

- guest first match works with no auth server reachable
- password never appears in browser storage snapshot
- auth secrets absent from production browser bundle
- Google adapter disabled cleanly when credentials absent
- email verification/reset uses local test mail in CI/dev
- guest → account merge can be retried without duplicate progress
- server rejects client-authored verified score
- result insertion is idempotent
- invalid replay/build result rejected
- leaderboard order deterministic
- Around Me returns correct neighborhood
- public leaderboard response contains no email/internal secret fields

## Exit gate

Pass only when:
- guest flow remains fully playable
- local self-hosted email/password auth works
- Google sign-in can be enabled by environment configuration without architectural changes
- cloud-save contract and migration path pass tests
- one seeded challenge can create a server-verified leaderboard row
- forged client submissions fail
- public profile/leaderboard leaks no email or credential material
- provider-free local CI remains green
