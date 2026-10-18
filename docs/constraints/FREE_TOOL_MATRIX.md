# Free Tool Matrix — No Trials, No Card, No Adult-Only Dependency

The critical path is designed around local/open tooling.

| Purpose | Primary tool | Account | Card/trial | Critical-path use |
|---|---|---:|---:|---|
| Version control | Git | none locally | none | yes |
| Remote repo | GitHub | GitHub account | no paid trial needed | yes if available |
| Code editor | VS Code or VSCodium | no | no | yes |
| 3D authoring | Blender 5.2 LTS | no | no | yes |
| Human base | MPFB 2 | no | no | yes |
| HDRI/PBR assets | Poly Haven | no | no | yes |
| PBR assets | ambientCG | no | no | yes |
| 2D painting | Krita | no | no | yes |
| Vector art | Inkscape | no | no | yes |
| Image editing | GIMP | no | no | yes |
| Motion capture | FreeMoCap / Pose2Sim / Posetrak | no | no | optional/local |
| Audio editing | Audacity | no | no | yes |
| Original music | LMMS / MuseScore | no | no | optional |
| Browser renderer | Three.js | no | no | yes |
| Physics | Rapier JS/WASM | no | no | yes |
| Multiplayer | Colyseus 0.18 | no | no | yes/self-hosted |
| Bundling | Vite | no | no | yes |
| Unit tests | Vitest | no | no | yes |
| Browser tests | Playwright | no | no | yes |
| Asset optimization | glTF Transform / gltfpack | no | no | yes |
| Static public client | GitHub Pages | GitHub | no trial/card | optional |
| Multiplayer hosting | local/LAN/self-host | no provider | no | yes for development |

## Explicitly excluded from the critical path

Do not make the build depend on:
- paid AI-3D credits
- asset subscriptions
- cloud-compute trial credits
- hosting that requires card verification to activate the relevant tier
- commercial-only free plans
- age-restricted accounts the owner cannot legitimately open

## Optional services

An optional future service may be documented only when:
1. the game remains fully functional without it
2. terms are rechecked at adoption time
3. age/account requirements are compatible
4. it does not require a trial or card unless the project constraints are explicitly changed

## V2 additions

| Purpose | Primary tool | Account | Card/trial | Critical-path use |
|---|---|---:|---:|---|
| AI Blender control | local Blender MCP bridge | none | none | yes for AI-centered art workflow |
| Reference-driven Blender process | `nicceasy/3d-product` skill/repo principles | none for local repo | none | yes as workflow discipline |
| Local auth framework | Better Auth | none | none | yes |
| Dev auth database | SQLite | none | none | yes |
| Persistent database | PostgreSQL | none self-hosted | none | yes before public leaderboard |
| Local email testing | Mailpit | none | none | yes for auth tests |
| Hosted auth/db | Supabase Free | account | re-check at adoption | optional adapter only |
| Google sign-in | Google OAuth/OIDC | Google developer account | re-check current setup terms | optional public provider |

### `3d-product` compatibility note

The repository includes a powerful Blender/product-render pipeline, but some optional paths described by it are not compatible with SoccerShooter's mandatory free-tool rule. The plan therefore uses its research, reference, measurement, greybox, preview-ladder, contact-sheet, versioning, and stage-gate methodology while keeping these optional only:
- Octane
- DaVinci Resolve Studio
- cloud rendering
- paid AI generation/music services
- FigJam

The mandatory SoccerShooter path is Blender + Cycles/Eevee + local scripts + FFmpeg + runtime validation.

### Hosted-backend rule

A hosted service is never required to pass local development gates. Before enabling Google/Supabase/another provider in a public deployment, the Auth/Persistence Agent must record a current terms check covering:
- price
- credit-card requirement
- trial status
- account age/minority restrictions
- usage quotas
- privacy implications
- exit/self-host path
