/**
 * The sense of sight (CLAUDE.md 2, "andere Sinne"): three bars, the outer two
 * given, the middle one drawn out until the three lengths carry the same
 * pattern as the small example above. No number on the screen; the eye
 * decides. Letting go is the answer.
 */
import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { texts } from '../texts';
import { fonts, radius, spacing, type } from '../theme';
import type { Palette } from '../theme';

interface Props {
  readonly a: number;
  readonly c: number;
  readonly example: readonly [number, number, number];
  readonly palette: Palette;
  readonly disabled?: boolean;
  readonly onChange: (dragging: boolean) => void;
  /** the finger is up: this length, in the units of a and c, is the answer */
  readonly onRelease: (value: number) => void;
  readonly testID?: string;
}

const BAR = 22;
const KNOB = 26;

export function Lengths({ a, c, example, palette, disabled, onChange, onRelease, testID }: Props) {
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [width, setWidth] = useState(0);
  // the middle starts at the lower bound: the player must draw it out
  const [value, setValue] = useState(a);
  const [active, setActive] = useState(false);
  const latest = useRef({ a, c, width, disabled: !!disabled, onChange, onRelease, value });
  latest.current = { a, c, width, disabled: !!disabled, onChange, onRelease, value };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !latest.current.disabled,
        onMoveShouldSetPanResponder: () => !latest.current.disabled,
        onPanResponderGrant: (e) => {
          setActive(true);
          latest.current.onChange(true);
          setValue(read(e.nativeEvent.locationX));
        },
        onPanResponderMove: (e) => setValue(read(e.nativeEvent.locationX)),
        onPanResponderRelease: () => finish(),
        onPanResponderTerminate: () => finish(),
      }),
    [],
  );

  function read(x: number): number {
    const { a, c, width } = latest.current;
    const w = Math.max(1, width);
    return Math.min(c, Math.max(a, (x / w) * c));
  }

  function finish() {
    setActive(false);
    latest.current.onChange(false);
    latest.current.onRelease(latest.current.value);
  }

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const px = (v: number) => (width * v) / c;
  const [x, y, z] = example;

  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.example}>
        <Text style={styles.caption}>{texts.lengthExample}</Text>
        <View style={styles.exampleBars}>
          {[x, y, z].map((v, i) => (
            <View key={i} style={[styles.exampleBar, { width: `${(100 * v) / z}%` }]} />
          ))}
        </View>
      </View>
      <View style={styles.bars} onLayout={onLayout}>
        <View style={[styles.bar, { width: px(a) }]} />
        <View style={styles.middleRow} {...responder.panHandlers} accessibilityRole="adjustable" accessibilityLabel={texts.lengthExample} testID={testID ? `${testID}-middle` : undefined}>
          <View style={[styles.bar, styles.middle, { width: px(value) }, active && styles.middleActive]} />
          <View style={[styles.knob, { left: Math.max(0, px(value) - KNOB / 2) }, active && styles.knobActive]} />
        </View>
        <View style={[styles.bar, { width: px(c) }]} />
      </View>
    </View>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    wrap: { marginTop: spacing.lg, gap: spacing.lg },
    example: { gap: spacing.xs },
    caption: { fontFamily: fonts.text, fontSize: type.small.fontSize, color: p.muted, letterSpacing: 0.5 },
    exampleBars: { gap: 3, width: '40%' },
    exampleBar: { height: 6, borderRadius: 3, backgroundColor: p.accent, opacity: 0.8 },
    bars: { gap: spacing.md },
    bar: { height: BAR, borderRadius: radius.box, backgroundColor: p.accent },
    middleRow: { height: KNOB + 8, justifyContent: 'center' },
    middle: { backgroundColor: p.missing },
    middleActive: { opacity: 0.9 },
    knob: { position: 'absolute', top: 4, width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: p.missing, borderWidth: 2, borderColor: p.background },
    knobActive: { transform: [{ scale: 1.2 }] },
  });
}
