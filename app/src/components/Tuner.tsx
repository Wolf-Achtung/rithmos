/**
 * The tuning track for "Stimmen": a finger on the track moves the middle
 * tone between a and c and the ear decides. Nothing locks in, nothing
 * colours, no number shows; letting go is the answer (CLAUDE.md 2). Built
 * from core React Native (PanResponder), no slider library.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { BASE_FREQUENCY } from '../middles/chord';
import { startDrone } from '../middles/tone';
import type { Drone } from '../middles/tone';
import { valueAt } from '../middles/tuning';
import { texts } from '../texts';
import { fonts, spacing, type } from '../theme';
import type { Palette } from '../theme';

export interface TunerState {
  /** the value under the finger; the screen must not show it */
  readonly value: number;
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
  readonly onRelease: (value: number) => void;
  readonly testID?: string;
}

const KNOB = 28;

export function Tuner({ a, c, palette, soundOn, disabled, onChange, onRelease, testID }: Props) {
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [width, setWidth] = useState(0);
  const [position, setPosition] = useState(0.5);
  const [active, setActive] = useState(false);
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
          const value = valueAt(p, a, c);
          setActive(true);
          setPosition(p);
          latest.current.onChange({ value });
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
          const value = valueAt(p, a, c);
          setPosition(p);
          latest.current.onChange({ value });
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
      latest.current.onChange(null);
      latest.current.onRelease(valueAt(p, a, c));
      return p;
    });
  }

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const left = position * Math.max(0, width - KNOB);

  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.track} onLayout={onLayout} {...responder.panHandlers} accessibilityRole="adjustable" accessibilityLabel="Fehlender Ton">
        <View style={styles.rail} />
        <View style={[styles.knob, { left }, active && styles.knobActive]} />
      </View>
      <View style={styles.ends}>
        <Text style={styles.end}>{a}</Text>
        <Text style={styles.hint}>{texts.tunerHint}</Text>
        <Text style={styles.end}>{c}</Text>
      </View>
    </View>
  );
}

function clamp(p: number): number {
  return Math.min(1, Math.max(0, p));
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    wrap: { marginTop: spacing.lg },
    track: { height: 56, justifyContent: 'center' },
    rail: { height: 4, borderRadius: 2, backgroundColor: p.trackEmpty, marginHorizontal: KNOB / 2 },
    knob: { position: 'absolute', top: (56 - KNOB) / 2, width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: p.missing, borderWidth: 2, borderColor: p.background },
    knobActive: { transform: [{ scale: 1.25 }] },
    ends: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
    end: { fontFamily: fonts.text, fontSize: type.small.fontSize, color: p.muted },
    hint: { fontFamily: fonts.text, fontSize: type.small.fontSize, color: p.missing, letterSpacing: 0.3 },
  });
}
