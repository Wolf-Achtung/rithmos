/**
 * Verification of structured claims (CLAUDE.md section 5).
 *
 * The player says why a move is good; a translator turns that into a Claim;
 * this module checks the Claim against the engine. The truth always comes
 * from the engine. verifyClaim is pure and deterministic.
 */
import { opponent, pieceById } from './board';
import { captureToString, findCaptures } from './capture';
import type { CaptureMethod } from './capture';
import { explainCapture, describeExplanation } from './explain';
import { reachableHarmonies } from './harmony';
import type { HarmonyKind, ReachableHarmony } from './harmony';
import { applyMove, isLegalMove, moveToString } from './moves';
import type { Move } from './moves';
import type { PieceId, Position } from './types';

export type Claim =
  | { kind: 'capture_threat'; from: PieceId; to: PieceId; method?: CaptureMethod }
  | { kind: 'harmony_reachable'; pieces: PieceId[]; harmony?: HarmonyKind; withinMoves: number }
  | { kind: 'defends'; piece: PieceId; against: PieceId }
  | { kind: 'escapes'; piece: PieceId; from: PieceId }
  | { kind: 'blocks_harmony'; opponentPieces: PieceId[] }
  | { kind: 'unverifiable'; reason: string };

export interface ClaimResult {
  readonly holds: boolean;
  readonly evidence: string;
  readonly checkedAt: 'before' | 'after';
}

function claimedPieces(claim: Claim): PieceId[] {
  switch (claim.kind) {
    case 'capture_threat':
      return [claim.from, claim.to];
    case 'harmony_reachable':
      return claim.pieces;
    case 'defends':
      return [claim.piece, claim.against];
    case 'escapes':
      return [claim.piece, claim.from];
    case 'blocks_harmony':
      return claim.opponentPieces;
    case 'unverifiable':
      return [];
  }
}

function describeHarmony(h: ReachableHarmony): string {
  const via = h.via.length === 0 ? 'standing' : `via ${h.via.map(moveToString).join(', ')}`;
  return `${h.kinds.join('+')} ${h.arrangement} ${h.values.join('/')} (${h.pieces.join(', ')}) ${via}`;
}

function matchesHarmony(h: ReachableHarmony, pieces: readonly PieceId[], kind?: HarmonyKind): boolean {
  if (kind && !h.kinds.includes(kind)) return false;
  return pieces.every((id) => h.pieces.includes(id));
}

export function verifyClaim(pos: Position, move: Move, claim: Claim): ClaimResult {
  if (claim.kind === 'unverifiable') {
    return { holds: false, evidence: `unverifiable: ${claim.reason}`, checkedAt: 'before' };
  }
  for (const id of claimedPieces(claim)) {
    if (!pieceById(pos, id)) return { holds: false, evidence: `unknown piece: ${id}`, checkedAt: 'before' };
  }
  if (!isLegalMove(pos, move)) {
    return { holds: false, evidence: `illegal move: ${moveToString(move)}`, checkedAt: 'before' };
  }
  const side = pos.sideToMove;
  const enemy = opponent(side);
  const after = applyMove(pos, move);

  switch (claim.kind) {
    case 'capture_threat': {
      const from = pieceById(pos, claim.from)!;
      const to = pieceById(pos, claim.to)!;
      if (from.side !== side) return { holds: false, evidence: `${claim.from} is not an own piece`, checkedAt: 'before' };
      if (to.side !== enemy) return { holds: false, evidence: `${claim.to} is not an enemy piece`, checkedAt: 'before' };
      const hit = findCaptures(after, side).find(
        (c) => c.target === claim.to && c.by.includes(claim.from) && (!claim.method || c.method === claim.method),
      );
      if (hit) return { holds: true, evidence: captureToString(hit), checkedAt: 'after' };
      const verdict = explainCapture(after, side, { by: [claim.from], target: claim.to, ...(claim.method ? { method: claim.method } : {}) });
      return { holds: false, evidence: describeExplanation(after, verdict.primary), checkedAt: 'after' };
    }

    case 'harmony_reachable': {
      const own = claim.pieces.filter((id) => pieceById(pos, id)!.side === side);
      if (own.length !== claim.pieces.length) {
        return { holds: false, evidence: 'claimed pieces are not all own pieces', checkedAt: 'before' };
      }
      const within = Math.max(0, Math.min(2, Math.floor(claim.withinMoves)));
      const hits = reachableHarmonies(after, side, within).filter((h) => matchesHarmony(h, claim.pieces, claim.harmony));
      if (hits.length > 0) {
        const best = hits.reduce((a, b) => (b.via.length < a.via.length ? b : a));
        return { holds: true, evidence: describeHarmony(best), checkedAt: 'after' };
      }
      const any = reachableHarmonies(after, side, within);
      const note = any.length === 0 ? 'no harmony reachable' : `reachable instead: ${any.map(describeHarmony).join('; ')}`;
      return {
        holds: false,
        evidence: `no ${claim.harmony ?? ''} harmony with ${claim.pieces.join(', ')} within ${within} own move(s); ${note}`,
        checkedAt: 'after',
      };
    }

    case 'defends':
    case 'escapes': {
      const piece = claim.piece;
      const attacker = claim.kind === 'defends' ? claim.against : claim.from;
      if (pieceById(pos, piece)!.side !== side) return { holds: false, evidence: `${piece} is not an own piece`, checkedAt: 'before' };
      if (pieceById(pos, attacker)!.side !== enemy) return { holds: false, evidence: `${attacker} is not an enemy piece`, checkedAt: 'before' };
      if (claim.kind === 'escapes' && move.pieceId !== piece) {
        return { holds: false, evidence: `${piece} does not move; the move is ${moveToString(move)}`, checkedAt: 'before' };
      }
      const threatens = (p: Position) => findCaptures(p, enemy).filter((c) => c.target === piece && c.by.includes(attacker));
      const before = threatens(pos);
      if (before.length === 0) {
        return { holds: false, evidence: `${attacker} did not threaten ${piece} before the move`, checkedAt: 'before' };
      }
      const still = threatens(after);
      if (still.length > 0) {
        return { holds: false, evidence: `${attacker} still threatens ${piece}: ${still.map(captureToString).join('; ')}`, checkedAt: 'after' };
      }
      return { holds: true, evidence: `before: ${before.map(captureToString).join('; ')}; after: no threat by ${attacker}`, checkedAt: 'after' };
    }

    case 'blocks_harmony': {
      if (!claim.opponentPieces.every((id) => pieceById(pos, id)!.side === enemy)) {
        return { holds: false, evidence: 'claimed pieces are not all enemy pieces', checkedAt: 'before' };
      }
      const match = (p: Position) => reachableHarmonies(p, enemy, 1).filter((h) => matchesHarmony(h, claim.opponentPieces));
      const before = match(pos);
      if (before.length === 0) {
        return { holds: false, evidence: `the opponent had no harmony with ${claim.opponentPieces.join(', ')} within one move`, checkedAt: 'before' };
      }
      const still = match(after);
      if (still.length > 0) {
        return { holds: false, evidence: `still reachable: ${still.map(describeHarmony).join('; ')}`, checkedAt: 'after' };
      }
      return { holds: true, evidence: `blocked: ${before.map(describeHarmony).join('; ')}`, checkedAt: 'after' };
    }
  }
}
