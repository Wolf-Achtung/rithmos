# Benchmark: harmony.ts

Why this exists: the enumeration of reachable harmonies serves two clients,
the coverage metric and the search evaluation (CLAUDE.md section 4). It is
therefore measured, not only tested.

Run: `npm run bench` (Vitest bench, `engine/bench/harmony.bench.ts`).
Position: `engine/fixtures/midgame.ts`, 20 pieces per side, both sides with
stones in the enemy half, one harmony reachable in one move per side.

## Result, 2026-09-01

Machine: Intel Xeon @ 2.80 GHz (4 vCPU container), Node 22.22.2, Vitest 4.1.11.

| Operation | mean per call | calls / s |
|---|---|---|
| `findHarmonies`, standing, both sides | 0.23 ms | 4 379 |
| `reachableHarmonies` within 1 move, both sides (target-driven) | 0.48 ms | 2 079 |
| `reachableHarmoniesBrute` within 1 move, both sides (reference) | 13.9 ms | 72 |
| `reachableHarmonies` within 2 moves, white | 14.7 ms | 68 |
| `legalMoves`, both sides | 0.03 ms | 30 353 |
| `findCaptures`, both sides | 1.80 ms | 554 |

## Reading

- One evaluation of harmony proximity for one side costs about 0.25 ms.
  The target-driven enumeration is 29x faster than the brute-force reference
  and provably equal to it on random positions (`harmony.test.ts`).
- A full-width tree at this position has 54 x 45 nodes at depth 2, so about
  2 400 evaluations or 1.2 s. Depth 3 full-width is out of reach. The search
  therefore orders moves by static evaluation and keeps a beam
  (`search.ts`, parameter `breadth`), which brings depth 3 into the range of
  a few hundred milliseconds.
- `findCaptures` is dominated by the siege check, which plays every enemy
  move to test liberation. The search evaluation does not need it on every
  node; it uses the cheap methods and checks sieges only on the chosen line.
- Depth 2 of `reachableHarmonies` is for claim verification
  (`harmony_reachable`, `withinMoves: 2`), never for the search.

Not a Wolf-Ping: the numbers allow a usable opponent. They do rule out a
naive full-width search, which is recorded here as a design constraint.
