/**
 * Why a declared capture does not hold.
 *
 * The engine states the fact: which method was checked and which condition is
 * missing, with the numbers involved. Wording is a separate concern; a fixed
 * German text is available through describeExplanation() for the app until a
 * language model phrases it (CLAUDE.md section 7.1).
 */
import { pieceById, squareName } from './board';
import {
  ambushCaptures,
  assaultCaptures,
  meetingCaptures,
  siegeCaptures,
  targetValues,
  blockingPieces,
  liberatingMove,
} from './capture';
import type { Capture, CaptureMethod } from './capture';
import { canReach, legalMovesOf, regularDirections } from './moves';
import { inBounds, pieceAt } from './board';
import type { PieceId, PlacedPiece, Position, Side } from './types';

export interface CaptureAttempt {
  readonly by: readonly PieceId[];
  readonly target: PieceId;
  /** When omitted, the engine tries every method that fits the number of pieces. */
  readonly method?: CaptureMethod;
}

export type ExplainFailure =
  | { code: 'unknown_piece'; piece: PieceId }
  | { code: 'not_an_enemy'; target: PieceId }
  | { code: 'wrong_piece_count'; method: CaptureMethod; expected: string; got: number }
  | { code: 'not_reachable'; method: 'meeting' | 'ambush'; piece: PieceId; target: PieceId }
  | { code: 'value_mismatch'; method: 'meeting'; attacker: number; target: number }
  | { code: 'ambush_mismatch'; method: 'ambush'; values: number[]; sum: number; difference: number | null; target: number }
  | { code: 'not_in_line'; method: 'assault'; piece: PieceId; target: PieceId }
  | { code: 'zero_distance'; method: 'assault'; value: number; target: number }
  | {
      code: 'assault_mismatch';
      method: 'assault';
      value: number;
      distance: number;
      times: number;
      divided: number | null;
      target: number;
      /** A distance at which the same attacker would capture this target, if one exists. */
      fittingDistance: number | null;
    }
  | { code: 'target_can_move'; method: 'siege'; moves: number }
  | { code: 'no_besieger'; method: 'siege' }
  | { code: 'target_can_be_freed'; method: 'siege'; by: PieceId };

export interface Explanation {
  readonly method: CaptureMethod;
  readonly holds: boolean;
  readonly capture?: Capture;
  readonly failure?: ExplainFailure;
}

export interface CaptureVerdict {
  readonly holds: boolean;
  /** The explanation that counts: the holding one, or the most informative failure. */
  readonly primary: Explanation;
  readonly tried: readonly Explanation[];
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

function findHolding(caps: Capture[], attempt: CaptureAttempt): Capture | undefined {
  return caps.find((c) => c.target === attempt.target && sameSet(c.by, attempt.by));
}

function explainMeeting(pos: Position, side: Side, attempt: CaptureAttempt, target: PlacedPiece): Explanation {
  const method = 'meeting';
  if (attempt.by.length !== 1) {
    return { method, holds: false, failure: { code: 'wrong_piece_count', method, expected: 'one piece', got: attempt.by.length } };
  }
  const holding = findHolding(meetingCaptures(pos, side), attempt);
  if (holding) return { method, holds: true, capture: holding };
  const a = pieceById(pos, attempt.by[0]!)!;
  if (!canReach(pos, a, target.square, { allowEnemyTarget: true })) {
    return { method, holds: false, failure: { code: 'not_reachable', method, piece: a.id, target: target.id } };
  }
  return { method, holds: false, failure: { code: 'value_mismatch', method, attacker: a.value, target: target.value } };
}

function explainAmbush(pos: Position, side: Side, attempt: CaptureAttempt, target: PlacedPiece): Explanation {
  const method = 'ambush';
  if (attempt.by.length < 2) {
    return { method, holds: false, failure: { code: 'wrong_piece_count', method, expected: 'two or more pieces', got: attempt.by.length } };
  }
  const holding = findHolding(ambushCaptures(pos, side), attempt);
  if (holding) return { method, holds: true, capture: holding };
  for (const id of attempt.by) {
    const a = pieceById(pos, id)!;
    if (!canReach(pos, a, target.square, { allowEnemyTarget: true })) {
      return { method, holds: false, failure: { code: 'not_reachable', method, piece: a.id, target: target.id } };
    }
  }
  const values = attempt.by.map((id) => pieceById(pos, id)!.value);
  const sum = values.reduce((s, v) => s + v, 0);
  const difference = values.length === 2 ? Math.abs(values[0]! - values[1]!) : null;
  return { method, holds: false, failure: { code: 'ambush_mismatch', method, values, sum, difference, target: target.value } };
}

/** Empty squares between attacker and target along a regular direction, or null when not in line. */
export function assaultDistance(pos: Position, attacker: PlacedPiece, target: PlacedPiece): number | null {
  for (const d of regularDirections(pos, attacker)) {
    let sq = attacker.square;
    let distance = 0;
    for (;;) {
      sq = { file: sq.file + d.df, rank: sq.rank + d.dr };
      if (!inBounds(pos.rules, sq)) break;
      const occ = pieceAt(pos, sq);
      if (!occ) {
        distance++;
        continue;
      }
      if (occ.id === target.id) return distance;
      break;
    }
  }
  return null;
}

function fittingDistance(value: number, target: number): number | null {
  if (target % value === 0 && target / value >= 1) return target / value;
  if (value % target === 0 && value / target >= 1) return value / target;
  return null;
}

function explainAssault(pos: Position, side: Side, attempt: CaptureAttempt, target: PlacedPiece): Explanation {
  const method = 'assault';
  if (attempt.by.length !== 1) {
    return { method, holds: false, failure: { code: 'wrong_piece_count', method, expected: 'one piece', got: attempt.by.length } };
  }
  const holding = findHolding(assaultCaptures(pos, side), attempt);
  if (holding) return { method, holds: true, capture: holding };
  const a = pieceById(pos, attempt.by[0]!)!;
  const distance = assaultDistance(pos, a, target);
  if (distance === null) {
    return { method, holds: false, failure: { code: 'not_in_line', method, piece: a.id, target: target.id } };
  }
  if (distance === 0) {
    return { method, holds: false, failure: { code: 'zero_distance', method, value: a.value, target: target.value } };
  }
  const divided = a.value % distance === 0 ? a.value / distance : null;
  return {
    method,
    holds: false,
    failure: {
      code: 'assault_mismatch',
      method,
      value: a.value,
      distance,
      times: a.value * distance,
      divided,
      target: target.value,
      fittingDistance: fittingDistance(a.value, target.value),
    },
  };
}

function explainSiege(pos: Position, side: Side, attempt: CaptureAttempt, target: PlacedPiece): Explanation {
  const method = 'siege';
  const caps = siegeCaptures(pos, side).filter((c) => c.target === target.id);
  // A siege is a property of the target's position; the declared besiegers only need to be among the blockers.
  const holding = caps.find((c) => attempt.by.every((id) => c.by.includes(id)));
  if (holding) return { method, holds: true, capture: holding };
  const moves = legalMovesOf(pos, target).length;
  if (moves > 0) return { method, holds: false, failure: { code: 'target_can_move', method, moves } };
  if (!blockingPieces(pos, target).some((p) => p.side === side)) {
    return { method, holds: false, failure: { code: 'no_besieger', method } };
  }
  const freeing = liberatingMove(pos, target);
  if (freeing) {
    return { method, holds: false, failure: { code: 'target_can_be_freed', method, by: freeing.pieceId } };
  }
  // Declared besiegers are not among the blockers.
  const offender = attempt.by.find((id) => !blockingPieces(pos, target).some((p) => p.id === id)) ?? attempt.by[0] ?? '';
  return { method, holds: false, failure: { code: 'not_reachable', method: 'meeting', piece: offender, target: target.id } };
}

const RANK: Record<ExplainFailure['code'], number> = {
  // higher is more informative: a numeric near-miss beats a geometric impossibility
  assault_mismatch: 9,
  ambush_mismatch: 9,
  value_mismatch: 9,
  target_can_be_freed: 8,
  zero_distance: 7,
  target_can_move: 6,
  no_besieger: 5,
  not_reachable: 4,
  not_in_line: 4,
  wrong_piece_count: 2,
  not_an_enemy: 1,
  unknown_piece: 0,
};

/**
 * Check a declared capture for `side` against the position and explain the result.
 */
export function explainCapture(pos: Position, side: Side, attempt: CaptureAttempt): CaptureVerdict {
  const fail = (method: CaptureMethod, failure: ExplainFailure): CaptureVerdict => {
    const e: Explanation = { method, holds: false, failure };
    return { holds: false, primary: e, tried: [e] };
  };
  const method0 = attempt.method ?? (attempt.by.length >= 2 ? 'ambush' : 'meeting');
  for (const id of [...attempt.by, attempt.target]) {
    if (!pieceById(pos, id)) return fail(method0, { code: 'unknown_piece', piece: id });
  }
  const target = pieceById(pos, attempt.target)!;
  if (target.side === side) return fail(method0, { code: 'not_an_enemy', target: target.id });
  for (const id of attempt.by) {
    if (pieceById(pos, id)!.side !== side) return fail(method0, { code: 'unknown_piece', piece: id });
  }

  const methods: CaptureMethod[] = attempt.method
    ? [attempt.method]
    : attempt.by.length >= 2
      ? ['ambush', 'siege']
      : ['meeting', 'assault', 'siege'];
  const tried: Explanation[] = methods.map((m) => {
    switch (m) {
      case 'meeting':
        return explainMeeting(pos, side, attempt, target);
      case 'ambush':
        return explainAmbush(pos, side, attempt, target);
      case 'assault':
        return explainAssault(pos, side, attempt, target);
      case 'siege':
        return explainSiege(pos, side, attempt, target);
    }
  });
  const holding = tried.find((e) => e.holds);
  if (holding) return { holds: true, primary: holding, tried };
  const primary = [...tried].sort((a, b) => RANK[b.failure!.code] - RANK[a.failure!.code])[0]!;
  return { holds: false, primary, tried };
}

const METHOD_DE: Record<CaptureMethod, string> = {
  meeting: 'Begegnung',
  ambush: 'Hinterhalt',
  assault: 'Angriff',
  siege: 'Belagerung',
};

const NUMBER_DE = ['null', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn'];
const fields = (n: number) => `${NUMBER_DE[n] ?? String(n)} ${n === 1 ? 'Feld' : 'Felder'}`;
const fieldsDative = (n: number) => (n === 1 ? 'einem Feld' : `${NUMBER_DE[n] ?? String(n)} Feldern`);

/** Fixed German wording of an explanation. One sentence on the missing condition, one hint where there is one. */
export function describeExplanation(pos: Position, e: Explanation): string {
  const name = METHOD_DE[e.method];
  if (e.holds) return `${name}: gültig.`;
  const f = e.failure!;
  switch (f.code) {
    case 'unknown_piece':
      return `Den Stein ${f.piece} gibt es in dieser Stellung nicht.`;
    case 'not_an_enemy':
      return `${f.target} ist ein eigener Stein.`;
    case 'wrong_piece_count':
      return `${name} braucht ${f.expected === 'one piece' ? 'genau einen Stein' : 'mindestens zwei Steine'}, angegeben ${f.got === 1 ? 'ist einer' : `sind ${f.got}`}.`;
    case 'not_reachable': {
      const p = pieceById(pos, f.piece);
      const t = pieceById(pos, f.target);
      return `${name}: ${f.piece} könnte im nächsten Zug nicht auf ${t ? squareName(t.square) : f.target} ziehen${p ? ` (${p.shape === 'round' ? 'Runde, ein Feld gerade' : p.shape === 'triangle' ? 'Dreieck, zwei Felder diagonal' : p.shape === 'square' ? 'Quadrat, drei Felder' : 'Pyramide'})` : ''}.`;
    }
    case 'value_mismatch':
      return `Begegnung: dein Stein hat ${f.attacker}, das Ziel hat ${f.target}. Begegnung braucht gleiche Werte.`;
    case 'ambush_mismatch': {
      const diff = f.difference === null ? '' : `, Differenz ${f.difference}`;
      return `Hinterhalt: ${f.values.join(' + ')} = ${f.sum}${diff}, dein Ziel hat ${f.target}.`;
    }
    case 'not_in_line':
      return `Angriff: ${f.piece} steht nicht in seiner Zugrichtung mit freier Bahn vor ${f.target}.`;
    case 'zero_distance':
      return `Angriff braucht mindestens ein leeres Feld dazwischen. Direkt daneben zählt nur die Begegnung, und ${f.value} ist nicht ${f.target}.`;
    case 'assault_mismatch': {
      const div = f.divided === null ? `${f.value} : ${f.distance} geht nicht auf` : `${f.value} : ${f.distance} = ${f.divided}`;
      const hint = f.fittingDistance === null ? '' : ` Mit ${fieldsDative(f.fittingDistance)} Abstand würde es passen.`;
      return `Angriff über ${fields(f.distance)}: ${f.value} × ${f.distance} = ${f.times}, ${div}, dein Ziel hat ${f.target}.${hint}`;
    }
    case 'target_can_move':
      return `Belagerung: das Ziel kann noch ziehen (${f.moves === 1 ? 'ein Zug' : `${f.moves} Züge`}).`;
    case 'no_besieger':
      return `Belagerung: keiner deiner Steine sperrt das Ziel, nur Rand und eigene Steine des Gegners.`;
    case 'target_can_be_freed':
      return `Belagerung: ${f.by} könnte das Ziel mit einem einzigen Zug befreien.`;
  }
}

export { targetValues };
