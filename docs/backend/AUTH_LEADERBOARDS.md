# SoccerShooter — Authentication, Cloud Save, Profiles, and Leaderboards

## Product requirement

Players can begin immediately as guests. Google is the preferred low-friction account option. Any normal email can be used through the email authentication path. Accounts provide cloud persistence and verified leaderboards.

## Critical constraint

The architecture must remain buildable without:
- a credit card
- a paid/timed trial
- an adult-only mandatory developer account

Therefore the canonical implementation is local/self-hostable. Hosted services are adapters.

## Recommended stack

### Canonical local stack
- Better Auth
- SQLite during first development pass
- PostgreSQL before public persistence/leaderboards
- Mailpit for local verification/reset email testing
- Node server owns auth routes

Benefits:
- TypeScript-native
- email/password support
- social providers including Google
- self-hosted database
- no external auth vendor required to develop

### Google public sign-in
Use OpenID Connect/OAuth with minimum scopes:
- `openid`
- `email`
- `profile`

Google account minimum age is generally 13 in the US according to Google Account Help. Recheck current developer-platform terms when enabling the OAuth client.

### Optional Supabase deployment adapter
Useful features:
- Postgres
- Auth
- Google/social OAuth
- email/password
- RLS
- Realtime
- generous free tier

But do not make it mandatory. Recheck current no-card and developer-account terms before adoption. Supabase's privacy page says its services are not intended for children under 13, but the project still treats legal/account requirements as a deployment-time verification gate.

## No plaintext credentials

Never store user passwords directly.

If using Better Auth:
- let the framework manage credential hashing/verification
- require email verification for password accounts before global competitive submission
- enable OAuth token encryption if tokens are retained
- rotate auth secret using supported mechanism

Secrets:
- `.env.local` ignored
- `.env.example` contains names only
- production secret injected by host
- Google client secret server-only

Browser persistence:
- no password
- no service/admin token
- prefer secure HTTP-only session cookie where topology permits

## Guest account

Local data:
- local profile UUID
- display name temporary/default
- progression
- settings
- local replay index
- unlock/mastery state

Guest cannot:
- enter verified global leaderboard
- enter ranked PvP
- claim cloud sync

## Account linking

Guest → Google/email must migrate progress transactionally.

Algorithm:
1. authenticate
2. load cloud profile
3. snapshot guest save
4. detect conflicts
5. apply deterministic merge policy
6. save new cloud revision
7. read back and verify hash
8. only then mark local save linked

Never delete guest save before verification.

## Data model

### `profiles`
- `user_id` PK/FK to auth user
- `display_name`
- `display_name_norm`
- `avatar_id`
- `favorite_team_id` optional cosmetic
- `created_at`
- `updated_at`
- `privacy_flags`

### `player_progress`
- `user_id`
- `save_revision`
- `road_act`
- `ovr_display`
- `xp`
- `mastery_json` or normalized mastery table later
- `unlocks_json`
- `updated_at`

### `match_results`
- `result_id`
- `match_id`
- `build_version`
- `sim_version`
- `ruleset_id`
- `seed`
- `started_at`
- `ended_at`
- `validity_status`
- `replay_hash`

### `match_players`
- `match_id`
- `user_id`
- `team`
- `scoreline`
- `goals`
- `assists`
- `saves`
- `passes_attempted`
- `passes_completed`
- `interceptions`
- `tackles`
- `distance_m`
- other non-authoritative display aggregates generated from server events

### `challenge_results`
- `challenge_id`
- `user_id`
- `score`
- `time_ms`
- `tie_break_json`
- `match_id`
- `verified_at`

### `seasons`
- `season_id`
- start/end
- ruleset
- status

### `ratings`
Later PvP rating fields.

## Leaderboard categories

### Daily challenge
Everyone receives same seed/ruleset/build range.

Sort:
1. score descending
2. failure/concession count ascending when applicable
3. valid completion time ascending
4. verified submission time ascending only as last stable tie-break

### Weekly challenge
Same pattern, larger challenge.

### Road to Legend
Separate boards by challenge so progression advantage does not invalidate comparison.

### PvP ranked later
Use a real rating algorithm chosen/tested in a later stage; do not invent a vanity “OVR ranking.”

## Server authority

A browser client cannot write competitive rows directly.

Flow:
1. authoritative match server completes match
2. result event log finalized
3. replay/event hash finalized
4. server validates rules/build/user session
5. idempotent result transaction written
6. leaderboard query/view reflects verified record

## RLS/authorization principles

If using Supabase/Postgres RLS:
- public may read approved public profile fields and leaderboard views
- user can edit own profile only
- user can read own cloud save
- competitive result insertion unavailable to anonymous/browser role
- trusted server/function inserts verified results

## Leaderboard UI

Tabs:
- Daily
- Weekly
- Road to Legend
- Ranked later

Views:
- Top 100
- Around Me
- Friends later

Row:
- rank
- avatar
- display name
- primary score/rating
- secondary tie-break
- small replay icon if public replay is available

Never display email.

## Abuse controls

- normalized display names
- profanity/moderation filter
- rate limits
- idempotency keys
- replay/result hash
- build-version whitelist
- anomaly flags
- report function later

## Tests

Required:
- guest can play with network offline
- Google/email account adapters conform to same interface
- no password appears in client persistence
- guest merge is idempotent
- competing cloud/local saves resolve deterministically
- client direct leaderboard insert rejected
- duplicate result insert does not duplicate leaderboard
- invalid build result rejected
- leaderboard order/tie-break deterministic
- account deletion/anonymization behavior documented before public release

## Exit gate

- guest loop works without cloud
- local self-hosted auth integration test passes
- Google adapter can be enabled without changing gameplay/progression code
- email auth test passes locally
- cloud save revision/readback test passes
- leaderboard seeded challenge works using server-verified result
- no client route can forge leaderboard score
