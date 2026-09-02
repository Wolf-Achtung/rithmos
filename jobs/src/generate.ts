/**
 * Nightly job: generate the Middles puzzles for the coming days and hand
 * them to the API. Usage (after `npm run jobs:build`):
 *
 *   node jobs/dist/generate.js [--days 7] [--from 2026-09-01] [--out puzzles.json] [--replace]
 *
 * --replace overwrites days that already have attempts (the generator is deterministic,
 * so this only adds what a newer generator ships, such as finds and narration facts).
 *
 * With RITHMOS_API_URL and RITHMOS_JOBS_TOKEN set, the puzzles are posted to
 * POST {RITHMOS_API_URL}/v1/admin/puzzles. Without them, they are written to
 * --out or to stdout. Secrets come from the environment only.
 */
import { generateMiddles, isoDate, verifyMiddles } from './middles';
import type { MiddlesPuzzle } from './middles';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const days = Number(arg('days') ?? 7);
  const from = arg('from') ?? isoDate(Date.now());
  const start = Date.parse(`${from}T00:00:00Z`);
  const puzzles: MiddlesPuzzle[] = [];
  for (let i = 0; i < days; i++) {
    const date = isoDate(start + i * 86_400_000);
    const puzzle = generateMiddles(date);
    const check = verifyMiddles(puzzle);
    if (!check.valid) throw new Error(`${date}: ${check.reason}`);
    puzzles.push(puzzle);
  }
  const apiUrl = process.env.RITHMOS_API_URL;
  const token = process.env.RITHMOS_JOBS_TOKEN;
  if (apiUrl && token) {
    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/v1/admin/puzzles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-jobs-token': token },
      body: JSON.stringify({ puzzles, replace: process.argv.includes('--replace') }),
    });
    if (!res.ok) throw new Error(`API answered ${res.status}: ${await res.text()}`);
    console.log(`posted ${puzzles.length} puzzles (${puzzles[0]!.date} .. ${puzzles[puzzles.length - 1]!.date})`);
    return;
  }
  const out = arg('out');
  const json = JSON.stringify({ puzzles }, null, 2);
  if (out) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(out, json);
    console.log(`wrote ${puzzles.length} puzzles to ${out}`);
  } else {
    console.log(json);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
