import { BricolageGrotesque_300Light, BricolageGrotesque_500Medium, BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import { DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mebben } from '../engine/rules/mebben';
import type { Session } from './src/api/client';
import { MiddlesScreen } from './src/screens/MiddlesScreen';
import { RulesScreen } from './src/screens/RulesScreen';
import { store } from './src/storage';
import { ensureSession } from './src/sync';
import { texts } from './src/texts';
import { fonts, palettes, radius, spacing, type } from './src/theme';
import type { Palette, ThemeName } from './src/theme';

const SETTINGS_KEY = 'middles:settings';

interface Settings {
  readonly sound: boolean;
  /** null: the direction's own look, dark */
  readonly theme: ThemeName | null;
}

const defaultSettings: Settings = { sound: true, theme: null };

/**
 * Stufe 1: Middles is the app. The board screens of the first version stay in
 * the repository and return with Stufe 4; until then nothing points at them.
 */
export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    [fonts.numeralLight]: BricolageGrotesque_300Light,
    [fonts.numeral]: BricolageGrotesque_500Medium,
    [fonts.numeralBold]: BricolageGrotesque_700Bold,
    [fonts.text]: DMSans_400Regular,
    [fonts.textMedium]: DMSans_500Medium,
  });
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [settingsReady, setSettingsReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [sheet, setSheet] = useState<'none' | 'settings' | 'rules'>('none');

  useEffect(() => {
    let alive = true;
    (async () => {
      const stored = await store.read<Partial<Settings>>(SETTINGS_KEY, {});
      if (!alive) return;
      setSettings({ ...defaultSettings, ...stored });
      setSettingsReady(true);
      const s = await ensureSession();
      if (alive) setSession(s);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const themeName: ThemeName = settings.theme ?? 'dark';
  const palette = palettes[themeName];
  const styles = useMemo(() => makeStyles(palette), [palette]);

  function update(patch: Partial<Settings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void store.write(SETTINGS_KEY, next);
      return next;
    });
  }

  if ((!fontsLoaded && !fontError) || !settingsReady) return <View style={styles.root} />;

  return (
    <SafeAreaView style={styles.root}>
      <MiddlesScreen session={session} palette={palette} soundOn={settings.sound} onOpenSettings={() => setSheet('settings')} />

      <Modal visible={sheet !== 'none'} transparent animationType="fade" onRequestClose={() => setSheet('none')}>
        <Pressable style={styles.scrim} onPress={() => setSheet('none')} testID="settings-scrim" />
        <View style={styles.sheet} testID="settings-sheet">
          {sheet === 'settings' ? (
            <>
              <Text style={styles.sheetTitle}>{texts.settings}</Text>
              <Row label={texts.settingsSound} styles={styles}>
                <Toggle
                  options={[
                    { value: true, label: texts.on },
                    { value: false, label: texts.off },
                  ]}
                  value={settings.sound}
                  onChange={(sound) => update({ sound })}
                  styles={styles}
                  testID="settings-sound"
                />
              </Row>
              <Row label={texts.settingsTheme} styles={styles}>
                <Toggle
                  options={[
                    { value: 'dark' as ThemeName, label: texts.themeName.dark },
                    { value: 'light' as ThemeName, label: texts.themeName.light },
                  ]}
                  value={themeName}
                  onChange={(theme) => update({ theme })}
                  styles={styles}
                  testID="settings-theme"
                />
              </Row>
              <Text style={styles.note}>{texts.ruleSetNote(mebben.name, mebben.source)}</Text>
              <View style={styles.sheetActions}>
                <Pressable onPress={() => setSheet('rules')} style={styles.textButton} testID="settings-rules">
                  <Text style={styles.textButtonLabel}>{texts.rules}</Text>
                </Pressable>
                <Pressable onPress={() => setSheet('none')} style={styles.textButton} testID="settings-close">
                  <Text style={styles.textButtonLabel}>{texts.close}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <ScrollView style={styles.rules}>
                <RulesScreen />
              </ScrollView>
              <View style={styles.sheetActions}>
                <Pressable onPress={() => setSheet('settings')} style={styles.textButton} testID="rules-back">
                  <Text style={styles.textButtonLabel}>{texts.settings}</Text>
                </Pressable>
                <Pressable onPress={() => setSheet('none')} style={styles.textButton} testID="rules-close">
                  <Text style={styles.textButtonLabel}>{texts.close}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </Modal>
      <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
    </SafeAreaView>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function Row({ label, styles, children }: { label: string; styles: Styles; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Toggle<T extends string | boolean>({ options, value, onChange, styles, testID }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; styles: Styles; testID: string }) {
  return (
    <View style={styles.toggle}>
      {options.map((o) => (
        <Pressable key={String(o.value)} onPress={() => onChange(o.value)} style={[styles.toggleItem, o.value === value && styles.toggleActive]} testID={`${testID}-${String(o.value)}`}>
          <Text style={[styles.toggleLabel, o.value === value && styles.toggleLabelActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: p.background },
    scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.55)' },
    sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '85%', width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: p.surface, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, borderWidth: 1, borderColor: p.border, padding: spacing.lg, gap: spacing.md },
    sheetTitle: { fontFamily: fonts.numeralBold, fontSize: type.title.fontSize, color: p.ink },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rowLabel: { fontFamily: fonts.text, fontSize: type.body.fontSize, color: p.ink },
    toggle: { flexDirection: 'row', borderRadius: radius.pill, borderWidth: 1, borderColor: p.border, overflow: 'hidden' },
    toggleItem: { paddingHorizontal: 14, paddingVertical: 8 },
    toggleActive: { backgroundColor: p.accent },
    toggleLabel: { fontFamily: fonts.textMedium, fontSize: type.small.fontSize, color: p.muted },
    toggleLabelActive: { color: p.accentInk },
    note: { fontFamily: fonts.text, fontSize: type.small.fontSize, lineHeight: type.small.lineHeight, color: p.muted },
    sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md },
    textButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    textButtonLabel: { fontFamily: fonts.textMedium, fontSize: type.body.fontSize, color: p.accent },
    rules: { maxHeight: 520 },
  });
}
