import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { CoverageRecord } from './src/coverage';
import type { Settings } from './src/game/store';
import { CoverageScreen } from './src/screens/CoverageScreen';
import { GameScreen } from './src/screens/GameScreen';
import { SetupScreen } from './src/screens/SetupScreen';
import { store } from './src/storage';
import { texts } from './src/texts';
import { colors, spacing } from './src/theme';

type Screen = 'setup' | 'game' | 'coverage';

const defaultSettings: Settings = { humanSide: 'white', strength: 'apprentice', assist: 3 };
const COVERAGE_KEY = 'coverage';

export default function App() {
  const [screen, setScreen] = useState<Screen>('setup');
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [records, setRecords] = useState<CoverageRecord[]>([]);

  useEffect(() => {
    let alive = true;
    store.read<CoverageRecord[]>(COVERAGE_KEY, []).then((r) => {
      if (alive) setRecords(r);
    });
    return () => {
      alive = false;
    };
  }, []);

  const onCoverage = useCallback(
    (coverage: number) => {
      setRecords((prev) => {
        const next = [...prev, { t: Date.now(), coverage, assist: settings.assist }];
        void store.write(COVERAGE_KEY, next);
        return next;
      });
    },
    [settings.assist],
  );

  const nav = (target: Screen, label: string) => (
    <Pressable onPress={() => setScreen(target)} testID={`nav-${target}`}>
      <Text style={[styles.nav, screen === target && styles.navActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topBar}>
        <Text style={styles.title}>{texts.appTitle}</Text>
        <View style={styles.navRow}>
          {nav(screen === 'game' ? 'game' : 'setup', texts.play)}
          {nav('coverage', texts.coverage)}
        </View>
      </View>
      {screen === 'setup' ? (
        <SetupScreen
          initial={settings}
          onStart={(s) => {
            setSettings(s);
            setScreen('game');
          }}
        />
      ) : null}
      {screen === 'game' ? <GameScreen settings={settings} onNewGame={() => setScreen('setup')} onCoverage={onCoverage} /> : null}
      {screen === 'coverage' ? <CoverageScreen records={records} /> : null}
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 18, fontWeight: '700', color: colors.ink, letterSpacing: 2 },
  navRow: { flexDirection: 'row', gap: spacing.lg },
  nav: { color: colors.accent, fontWeight: '600' },
  navActive: { textDecorationLine: 'underline' },
});
