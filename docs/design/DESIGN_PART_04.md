# 37. AI worker decision tree

When an AI agent receives a stage task:

1. **Read the spec, do not infer a new art direction.**
2. Identify the exact acceptance tests.
3. Produce the cheapest proof first.
4. Capture evidence.
5. Compare to target.
6. If it misses, revise before adding scope.
7. Run automated tests.
8. Run visual/performance checks.
9. Write the gate report.
10. Stop if the gate fails.

The AI must not:
- silently rewrite product scope
- generate large content batches before representative approval
- hide a failed metric under polish
- claim “premium” without evidence
- commit secrets
- use paid/trial/adult-only critical dependencies

---

# 38. Research sources that materially shaped this design

Reference-game research:
- Slopocalypse Reddit development post: https://www.reddit.com/r/vibecoding/comments/1x55yeh/3d_vampire_survivors_style_arcane_game_with/
- Slopocalypse: https://slopocalypse.app/
- Birds With Guns Reddit development post: https://www.reddit.com/r/vibecoding/comments/1x8bp9q/presenting_birds_with_guns_my_24_hour_challenge/

Action-football references:
- Sloclap REMATCH art direction and interviews
- ArtStation REMATCH Art Blast
- PlayStation REMATCH hands-on material

Academic/technical:
- Pichlmair & Johansen, *Designing Game Feel. A Survey*, arXiv:2011.09201
- Kim, Jung & Lee, *PhysicsFC: Learning User-Controlled Skills for a Physics-Based Football Player Controller*, arXiv:2504.21216
- Normoyle & Jörg, responsiveness vs. naturalness research
- latency/jitter/player-experience studies surfaced through SciSpace
- Khronos glTF PBR guidance
- Three.js documentation/manuals

AI Blender workflow:
- https://github.com/nicceasy/3d-product
- Blender Foundation MCP server information
- safety-aware/community Blender MCP implementations

Authentication:
- Better Auth official documentation
- Google Identity/OAuth documentation
- Supabase official Auth/pricing/privacy docs as an optional hosted adapter

---

# 39. Final visual acceptance statement

A screenshot can attract someone once. SoccerShooter succeeds only if the live game keeps the promise of the screenshot.

A build is visually successful when:
- the ball is never lost in noise
- the athlete responds immediately
- contact looks connected to physics
- team identity is obvious
- the arena feels authored
- the UI feels like sport, not software
- effects communicate importance instead of begging for attention
- a difficult goal looks spectacular because the play was difficult
- the game still reads clearly when every optional effect is turned down
- the same scene remains smooth enough to preserve the feel that the art exists to support
