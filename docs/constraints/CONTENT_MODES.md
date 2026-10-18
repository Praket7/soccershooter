# Content Modes and Identity Guardrails

## Why the project needs two modes

The game can evoke football culture without treating a nickname as a legal shield. Exact copied crests, kit graphics, sponsor marks, player face scans, and distinctive commercial branding can raise rights issues even when the project is noncommercial.

The codebase therefore makes deployable original content and local reference content structurally different.

## `FICTIONAL_PUBLIC`

Default, committed, and deployable.

### Initial clubs

#### Blaugrena
- technical-possession identity
- deep garnet, rich blue, warm gold
- original abstract badge geometry
- fictional roster

#### Royal Whites
- elite-transition identity
- white, navy, champagne gold
- original badge
- fictional roster

#### Oil Company North
- positional/pressing identity
- sky blue, charcoal, copper
- original badge
- fictional roster

#### Oil Company Capital
- speed/flair identity
- navy, crimson, warm gold
- original badge
- fictional roster

These are directional inspirations only. Public assets must not copy real crest outlines, sponsor graphics, club typography, exact kit panel layouts, or manufacturer marks.

## `REFERENCE_PRIVATE`

Purpose: local development comparison only.

Allowed local metadata can include:
- real player names
- shirt numbers
- height/role/footedness notes
- manually entered technique references

Rules:
- store only under `private/reference-content/`
- gitignore the entire directory
- never include the folder in a production bundle
- production command hard-fails when reference mode is active
- UI displays `PRIVATE REFERENCE BUILD`
- no scraped photos, scans, or third-party art are committed

## Environment switch

```text
SOCCERSHOOTER_CONTENT_MODE=fictional
SOCCERSHOOTER_CONTENT_MODE=reference-private
```

Production commands must accept only `fictional`.
