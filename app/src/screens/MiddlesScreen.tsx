import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { pieceAt, pieceById, place, squareIndex, squareName } from '../../../engine/board';
import { victoryOf } from '../../../engine/harmony';
import type { Harmony } from '../../../engine/harmony';
import { applyMove, legalMovesOf } from '../../../engine/moves';
import type { PieceId, Position, Square } from '../../../engine/types';
import { generateMiddles, isoDate } from '../../../jobs/src/middles';
import { apiConfigured, fetchDistribution, fetchTodayPuzzle, submitAttempt } from '../api/client';
import type { Distribution, Puzzle, PuzzleMove, Session } from '../api/client';
import { Board } from '../components/Board';
import { kindName, texts } from '../texts';
import { colors, spacing } from '../theme';
import { Button } from './GameScreen';

interface Props {
  session: Session | null;
}

interface Loaded {
  readonly puzzle: Puzzle;
  readonly source: 'api' | 'local';
  /** Only for local puzzles: the stored answer, for the give-up view. */
  readonly localSolution?: { move: PuzzleMove; harmony: { kinds: readonly string[]; values: readonly number[] } };
}

interface Outcome {
  readonly solved: boolean;
  readonly harmony: { readonly kinds: readonly string[]; readonly values: readonly number[] };
  readonly solution: PuzzleMove;
  readonly tries: number;
  readonly distribution: Distribution | null;
}

function toPosition(p: Puzzle): Position {
  return place(
    p.pieces.map((x) => ({ id: x.id, side: x.side, shape: x.shape, value: x.value, at: x.square })),
    p.side,
  );
}

async function load(session: Session | null): Promise<Loaded> {
  if (apiConfigured) {
    try {
      const puzzle = await fetchTodayPuzzle(session);
      if (puzzle) return { puzzle, source: 'api' };
    } catch {
      // fall through to the local generator
    }
  }
  const local = generateMiddles(isoDate(Date.now()));
  return {
    puzzle: { date: local.date, side: local.side, difficulty: local.difficulty, pieces: local.pieces, attempted: false },
    source: 'local',
    localSolution: { move: local.solution, harmony: local.harmony },
  };
}

/** The daily puzzle: find the square where the middle stone completes the harmony. */
export function MiddlesScreen({ session }: Props) {
  const { width, height } = useWindowDimensions();
  const cellSize = Math.floor(Math.min((Math.min(width, 520) - 16) / 8, (height - 300) / 16));
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [selected, setSelected] = useState<PieceId | null>(null);
  const [wrong, setWrong] = useState(0);
  const [message, setMessage] = useState<string>(texts.middlesTap);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [started] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    load(session)
      .then(async (l) => {
        if (!alive) return;
        setLoaded(l);
        setPosition(toPosition(l.puzzle));
        if (l.puzzle.attempted) {
          const distribution = await fetchDistribution(l.puzzle.date).catch(() => null);
          if (alive) setOutcome({ solved: false, harmony: { kinds: [], values: [] }, solution: { pieceId: '', from: '', to: '' }, tries: 0, distribution });
          setMessage(texts.middlesAlready);
        }
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [session]);

  const targets = useMemo(() => {
    const out = new Set<number>();
    if (!position || !selected) return out;
    const piece = pieceById(position, selected);
    if (piece) for (const m of legalMovesOf(position, piece)) out.add(squareIndex(position.rules, m.to));
    return out;
  }, [position, selected]);

  async function finish(solved: boolean, move: PuzzleMove, harmony: Harmony | null) {
    if (!loaded) return;
    const tries = wrong + 1;
    const seconds = Math.round((Date.now() - started) / 1000);
    if (loaded.source === 'api' && session) {
      try {
        const r = await submitAttempt(session, loaded.puzzle.date, move, tries, seconds);
        setOutcome({ solved: r.solved, harmony: r.harmony, solution: r.solution, tries, distribution: r.distribution });
        return;
      } catch {
        // show what we know locally
      }
    }
    const local = loaded.localSolution;
    setOutcome({
      solved,
      harmony: harmony ? { kinds: harmony.kinds, values: harmony.values } : (local?.harmony ?? { kinds: [], values: [] }),
      solution: local?.move ?? move,
      tries,
      distribution: null,
    });
  }

  function onPress(square: Square) {
    if (!position || !loaded || outcome) return;
    const piece = pieceAt(position, square);
    if (selected) {
      const sel = pieceById(position, selected)!;
      const move = legalMovesOf(position, sel).find((m) => m.to.file === square.file && m.to.rank === square.rank);
      if (move) {
        const after = applyMove(position, move);
        const harmony = victoryOf(after, loaded.puzzle.side);
        const pm: PuzzleMove = { pieceId: move.pieceId, from: squareName(move.from), to: squareName(move.to) };
        setSelected(null);
        if (harmony) {
          setPosition(after);
          setMessage(texts.middlesSolved(harmony.kinds.map((k) => kindName[k]), harmony.values, wrong + 1));
          void finish(true, pm, harmony);
        } else {
          setWrong((w) => w + 1);
          setMessage(texts.middlesWrong(wrong + 1));
        }
        return;
      }
    }
    if (piece && piece.side === loaded.puzzle.side) {
      setSelected(selected === piece.id ? null : piece.id);
      setMessage(texts.middlesTap);
    }
  }

  function giveUp() {
    if (!loaded || !position || outcome) return;
    const move: PuzzleMove = { pieceId: 'm', from: '', to: '' };
    void finish(false, move, null);
    setMessage(texts.middlesGaveUp);
  }

  if (error) return <Text style={[styles.text, { padding: spacing.lg }]}>{texts.apiError(error)}</Text>;
  if (!loaded || !position) return <Text style={[styles.text, { padding: spacing.lg }]}>{texts.loading}</Text>;

  const sel = selected ? pieceById(position, selected) : null;
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>
        {texts.middles} · {loaded.puzzle.date} · {texts.difficulty[loaded.puzzle.difficulty - 1] ?? ''}
      </Text>
      <Text style={styles.intro}>{texts.middlesIntro(loaded.puzzle.side)}</Text>
      <Board
        position={position}
        perspective={loaded.puzzle.side}
        cellSize={cellSize}
        highlights={{ selected: sel ? squareIndex(position.rules, sel.square) : null, targets }}
        onPress={onPress}
      />
      <Text style={styles.text} testID="middles-message">
        {message}
      </Text>
      {!outcome && wrong >= 3 ? <Button label={texts.middlesGiveUp} onPress={giveUp} testID="middles-give-up" /> : null}
      {outcome ? <OutcomeView outcome={outcome} source={loaded.source} /> : null}
      {loaded.source === 'local' ? <Text style={styles.small}>{texts.offlineNote}</Text> : null}
    </ScrollView>
  );
}

function OutcomeView({ outcome, source }: { outcome: Outcome; source: 'api' | 'local' }) {
  const d = outcome.distribution;
  const maxTries = 6;
  const bars = Array.from({ length: maxTries }, (_, i) => {
    const key = String(i + 1);
    const n = i + 1 < maxTries ? (d?.tries[key] ?? 0) : Object.entries(d?.tries ?? {}).filter(([k]) => Number(k) >= maxTries).reduce((s, [, v]) => s + v, 0);
    return { label: i + 1 < maxTries ? key : `${maxTries}+`, n };
  });
  const most = Math.max(1, ...bars.map((b) => b.n));
  return (
    <View style={styles.card}>
      {outcome.solution.to ? (
        <Text style={styles.text}>
          {texts.middlesSolution(outcome.solution.from, outcome.solution.to, outcome.harmony.values, outcome.harmony.kinds.map((k) => kindName[k as keyof typeof kindName] ?? k))}
        </Text>
      ) : null}
      {d ? (
        <>
          <Text style={styles.label}>{texts.distributionTitle(d.attempts, d.solved)}</Text>
          {bars.map((b) => (
            <View key={b.label} style={styles.barRow}>
              <Text style={styles.barLabel}>{b.label}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.round((b.n / most) * 100)}%` }, outcome.solved && b.label === String(outcome.tries) && styles.barMine]} />
              </View>
              <Text style={styles.barValue}>{b.n}</Text>
            </View>
          ))}
        </>
      ) : (
        <Text style={styles.small}>{source === 'api' ? texts.distributionUnavailable : texts.distributionOffline}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.lg },
  heading: { fontSize: 16, fontWeight: '700', color: colors.ink },
  intro: { color: colors.muted, textAlign: 'center', maxWidth: 520 },
  text: { color: colors.ink, textAlign: 'center', maxWidth: 520 },
  small: { color: colors.muted, fontSize: 12, textAlign: 'center', maxWidth: 520 },
  card: { width: '100%', maxWidth: 520, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.md, gap: spacing.xs },
  label: { color: colors.muted, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginTop: spacing.sm },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel: { width: 28, color: colors.muted, fontSize: 12, textAlign: 'right' },
  barTrack: { flex: 1, height: 12, backgroundColor: colors.squareLight, borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.border },
  barMine: { backgroundColor: colors.accent },
  barValue: { width: 32, color: colors.ink, fontSize: 12 },
});
