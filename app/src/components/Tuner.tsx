/**
 * The tuning track for "Stimmen": a finger on the track moves the middle
 * tone between a and c; whole-number means snap and sound clean; letting go
 * is the answer. Built from core React Native (PanResponder), no slider
 * library.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import type { HarmonyKind } from '../../../engine/harmony';
import { BASE_FREQUENCY } from '../middles/chord';
import { startDrone } from '../middles/tone';
import type { Drone } from '../middles/tone';
import { positionOf, snapNear, valueAt } from '../middles/tuning';
import type { Snap } from '../middles/tuning';
import { fonts, spacing, type } from '../theme';
import type { Palette } from '../theme';

export interface TunerState {
  /** the value under the finger, snapped when close to a whole-number mean */
  readonly value: number;
  readonly snap: Snap | null;
}

interface Props {
  readonly a: number;
  readonly c: number;
  readonly palette: Palette;
  readonly soundOn: boolean;
  readonly disabled?: boolean;
  /** live, while dragging; null when the finger is up */
  readonly onChange: (state: TunerState | null) => void;
  /** the finger is up: this is the answer */
  readonly onRelease: (value: number, snap: Snap | null) => void;
  readonly testID?: string;
}

const KNOB = 28;

export function Tuner({ a, c, palette, soundOn, disabled, onChange, onRelease, testID }: Props) {
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [width, setWidth] = useState(0);
  const [position, setPosition] = useState(0.5);
  const [active, setActive] = useState(false);
  const [snapped, setSnapped] = useState<HarmonyKind | null>(null);
  const drone = useRef<Drone | null>(null);
  const latest = useRef({ a, c, width, soundOn, disabled: !!disabled, onChange, onRelease });
  latest.current = { a, c, width, soundOn, disabled: !!disabled, onChange, onRelease };

  useEffect(() => () => drone.current?.stop(), []);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !latest.current.disabled,
        onMoveShouldSetPanResponder: () => !latest.current.disabled,
        onPanResponderGrant: (e) => {
          const { a, c, width, soundOn } = latest.current;
          const p = clamp((e.nativeEvent.locationX - KNOB / 2) / Math.max(1, width - KNOB));
          const { value, snap } = read(p, a, c);
          setActive(true);
          setPosition(p);
          setSnapped(snap?.kind ?? null);
          latest.current.onChange({ value, snap });
          if (soundOn) {
            void startDrone([BASE_FREQUENCY, (BASE_FREQUENCY * c) / a], (BASE_FREQUENCY * value) / a).then((d) => {
              drone.current?.stop();
              drone.current = d;
            });
          }
        },
        onPanResponderMove: (e) => {
          const { a, c, width } = latest.current;
          const p = clamp((e.nativeEvent.locationX - KNOB / 2) / Math.max(1, width - KNOB));
          const { value, snap } = read(p, a, c);
          setPosition(p);
          setSnapped(snap?.kind ?? null);
          latest.current.onChange({ value, snap });
          drone.current?.setMiddle((BASE_FREQUENCY * value) / a);
        },
        onPanResponderRelease: () => finish(),
        onPanResponderTerminate: () => finish(),
      }),
    [],
  );

  function finish() {
    drone.current?.stop();
    drone.current = null;
    setActive(false);
    setPosition((p) => {
      const { a, c } = latest.current;
      const { value, snap } = read(p, a, c);
      latest.current.onChange(null);
      latest.current.onRelease(value, snap);
      return p;
    });
  }

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const left = position * Math.max(0, width - KNOB);

  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.track} onLayout={onLayout} {...responder.panHandlers} accessibilityRole="adjustable" accessibilityLabel="Fehlender Ton">
        <View style={styles.rail} />
        {marks(a, c).map((m) => (
          <View key={m} style={[styles.mark, { left: KNOB / 2 + positionOf(m, a, c) * Math.max(0, width - KNOB) }]} />
        ))}
        <View style={[styles.knob, { left }, active && styles.knobActive, snapped !== null && styles.knobSnapped]} />
      </View>
      <View style={styles.ends}>
        <Text style={styles.end}>{a}</Text>
        <Text style={styles.end}>{c}</Text>
      </View>
    </View>
  );
}

function clamp(p: number): number {
  return Math.min(1, Math.max(0, p));
}

function read(position: number, a: number, c: number): TunerState {
  const raw = valueAt(position, a, c);
  const snap = snapNear(raw, a, c);
  return { value: snap ? snap.value : raw, snap };
}

/** Faint ticks at the whole numbers, so the track reads as a scale without naming the answer. */
function marks(a: number, c: number): number[] {
  const out: number[] = [];
  const step = c - a > 24 ? 4 : c - a > 12 ? 2 : 1;
  for (let v = a + 1; v < c; v++) if ((v - a) % step === 0) out.push(v);
  return out;
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    wrap: { marginTop: spacing.lg },
    track: { height: 56, justifyContent: 'center' },
    rail: { height: 4, borderRadius: 2, backgroundColor: p.trackEmpty, marginHorizontal: KNOB / 2 },
    mark: { position: 'absolute', top: 22, width: 1, height: 12, backgroundColor: p.border },
    knob: { position: 'absolute', top: (56 - KNOB) / 2, width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: p.missing, borderWidth: 2, borderColor: p.background },
    knobActive: { transform: [{ scale: 1.25 }] },
    knobSnapped: { backgroundColor: p.accent },
    ends: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
    end: { fontFamily: fonts.text, fontSize: type.small.fontSize, color: p.muted },
  });
}
