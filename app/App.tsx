import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { Session } from './src/api/client';
import { newRecordId, withIds } from './src/coverage';
import type { CoverageRecord } from './src/coverage';
import type { Settings } from './src/game/store';
import { CoverageScreen } from './src/screens/CoverageScreen';
import { GameScreen } from './src/screens/GameScreen';
import { MiddlesScreen } from './src/screens/MiddlesScreen';
import { RulesScreen } from './src/screens/RulesScreen';
import { SetupScreen } from './src/screens/SetupScreen';
import { store } from './src/storage';
import { deviceName, ensureSession, syncCoverage } from './src/sync';
import { texts } from './src/texts';
import { colors, spacing } from './src/theme';

type Screen = 'setup' | 'game' | 'middles' | 'coverage' | 'rules';

const defaultSettings: Settings = { humanSide: 'white', strength: 'apprentice', assist: 3 };
const COVERAGE_KEY = 'coverage';

export default function App() {
  const [screen, setScreen] = useState<Screen>('setup');
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [records, setRecords] = useState<CoverageRecord[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const syncing = useRef(false);

  // Sync is best effort: failures leave records unsynced for the next try.
  const sync = useCallback(async (s: Session | null, local: CoverageRecord[]) => {
    if (!s || syncing.current) return;
    syncing.current = true;
    try {
      const merged = await syncCoverage(s, local);
      setRecords(merged);
      await store.write(COVERAGE_KEY, merged);
    } catch {
      // offline: keep local state
    } finally {
      syncing.current = false;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const local = withIds(await store.read<Partial<CoverageRecord>[]>(COVERAGE_KEY, []));
      if (!alive) return;
      setRecords(local);
      const s = await ensureSession();
      if (!alive) return;
      setSession(s);
      await sync(s, local);
    })();
    return () => {
      alive = false;
    };
  }, [sync]);

  const onCoverage = useCallback(
    (coverage: number) => {
      setRecords((prev) => {
        const next = [...prev, { id: newRecordId(), t: Date.now(), coverage, assist: settings.assist, device: deviceName }];
        void store.write(COVERAGE_KEY, next);
        void sync(session, next);
        return next;
      });
    },
    [settings.assist, session, sync],
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
          {nav('middles', texts.middles)}
          {nav('coverage', texts.coverage)}
          {nav('rules', texts.rules)}
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
      {screen === 'middles' ? <MiddlesScreen session={session} /> : null}
      {screen === 'coverage' ? <CoverageScreen records={records} /> : null}
      {screen === 'rules' ? <RulesScreen /> : null}
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 18, fontWeight: '700', color: colors.ink, letterSpacing: 2 },
  navRow: { flexDirection: 'row', gap: spacing.md },
  nav: { color: colors.accent, fontWeight: '600' },
  navActive: { textDecorationLine: 'underline' },
});
