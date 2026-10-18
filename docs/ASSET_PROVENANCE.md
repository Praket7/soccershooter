# SoccerShooter Asset Provenance Contract

Every external or authored runtime asset must have a provenance entry before it can be marked shippable. This registry contract applies to **image, mesh, texture, audio, animation, font, and code** assets.

## Required registry fields

| Field | Meaning |
|---|---|
| `id` | Stable project-unique asset identifier |
| `kind` | `image`, `mesh`, `texture`, `audio`, `animation`, `font`, or `code` |
| `sourceType` | `original` or `third-party` |
| `source` | Canonical URL, repository path, or source-file path sufficient to audit origin |
| `author` | Creator/maintainer name or project identity |
| `license` | SPDX-style identifier when available, otherwise exact license name/reference |
| `modifications` | What SoccerShooter changed; write `none` when unchanged |
| `contentMode` | `FICTIONAL_PUBLIC` or `REFERENCE_PRIVATE` |
| `publicSafe` | Explicit boolean review decision |
| `shippingStatus` | `shippable`, `blocked`, or `reference-only` |

A shippable entry requires non-empty **source, author, and license** fields. Missing provenance never defaults to approval.

## Shipping rules

An asset may be `shippable` only when:
- its provenance fields are complete;
- its license permits the intended distribution/use;
- required attribution/license files are preserved;
- modifications are documented;
- `contentMode` is `FICTIONAL_PUBLIC`;
- `publicSafe` is `true`;
- the asset does not depend on uncommitted private reference material at runtime.

`REFERENCE_PRIVATE` content must always be:
- `publicSafe: false`
- `shippingStatus: reference-only` or `blocked`
- stored only under the local private-reference boundary defined by `CONTENT_MODES.md`

It can never be marked public or shippable.

## Original assets

Original does not mean “documentation optional.” For an original SoccerShooter asset:
- `sourceType: original`
- `source` points to its project source path or generation/source record
- `author` identifies the project/creator responsible
- `license` states the project-owned/public release status chosen for that asset
- AI-assisted references or generation steps are documented under `modifications`/source notes when relevant

Do not claim third-party material as original because it was edited.

## Third-party assets

Before importing third-party material:
1. capture the canonical source;
2. capture creator/project identity;
3. read the actual license;
4. preserve attribution/license requirements;
5. document modifications;
6. verify that the intended public build use is compatible;
7. block the asset if any required right or license status is unclear.

Preferred sources are project-compatible open/CC0/OFL assets already named in the free-tool plan. A convenient download is not evidence of permission.

## Asset-class notes

### image
Includes UI art, generated/curated references, icons, decals, logos, and baked images. Reference imagery is not automatically a shipping texture.

### mesh
Includes authored/imported model geometry and environment props. Source mesh and exported GLB lineage should be traceable.

### texture
Includes base-color, normal, roughness, metalness, emissive, mask, LUT, and other image maps. A texture inherited from a model pack needs its own or linked license provenance.

### audio
Includes SFX, ambience, music, voice, and recorded Foley. Do not ship copyrighted chants, club songs, or unclear sample-pack material.

### animation
Includes mocap, authored keyframes, retargeted clips, and generated motion. Record the motion source/license separately from the character mesh when they differ.

### font
Record the exact font family/source/license and keep required license text. Self-hosting does not erase the font license.

### code
Third-party snippets/libraries incorporated outside the package-manager dependency record still require source/license provenance when they become part of repository source or generated runtime code.

## Registry example

```json
{
  "id": "font-inter",
  "kind": "font",
  "sourceType": "third-party",
  "source": "https://github.com/rsms/inter",
  "author": "Rasmus Andersson / Inter project",
  "license": "OFL-1.1",
  "modifications": "Subset at build time only",
  "contentMode": "FICTIONAL_PUBLIC",
  "publicSafe": true,
  "shippingStatus": "shippable"
}
```

## Review workflow

- ingestion begins `blocked` unless provenance is already complete;
- automated schema validation checks required fields and private/public incompatibilities;
- human/lead review decides whether license/use interpretation is sufficient for shipping;
- source modifications update the provenance entry rather than overwriting history silently;
- a later discovery of uncertain rights immediately changes shipping status to `blocked` until resolved.

## Public identity guardrail

Renaming a real club is not enough. Public builds must not ship copied crest geometry, exact kit trade dress, sponsor marks, manufacturer marks, or real-player likenesses merely because the display name is fictionalized.

## Audit expectation

Before any release candidate, generate an inventory grouped by asset kind and shipping status. The release gate fails if a runtime asset lacks provenance or if any `REFERENCE_PRIVATE` entry appears in a deployable manifest.