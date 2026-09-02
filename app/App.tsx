import { BricolageGrotesque_300Light, BricolageGrotesque_500Medium, BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import { DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mebben } from '../engine/rules/mebben';
import type { Session } from './src/api/client';
import { mergeSkill } from './src/middles/skill';
import type { SkillRecord } from './src/middles/skill';
import { MiddlesScreen } from './src/screens/MiddlesScreen';
import { ChainScreen } from './src/screens/ChainScreen';
import { PracticeScreen } from './src/screens/PracticeScreen';
import { RulesScreen } from './src/screens/RulesScreen';
import { SkillScreen } from './src/screens/SkillScreen';
import { store } from './src/storage';
import { ensureSession, syncSkill } from './src/sync';
import { texts } from './src/texts';
import { fonts, palettes, radius, spacing, type } from './src/theme';
import type { Palette, ThemeName } from './src/theme';

const SETTINGS_KEY = 'middles:settings';
const SKILL_KEY = 'middles:skill';

type Tab = 'today' | 'chain' | 'practice' | 'skill';

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
  const [tab, setTab] = useState<Tab>('today');
  const [skill, setSkill] = useState<SkillRecord[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [stored, records] = await Promise.all([store.read<Partial<Settings>>(SETTINGS_KEY, {}), store.read<SkillRecord[]>(SKILL_KEY, [])]);
      if (!alive) return;
      setSettings({ ...defaultSettings, ...stored });
      setSkill(records);
      setSettingsReady(true);
      const s = await ensureSession();
      if (!alive) return;
      setSession(s);
      if (s) {
        try {
          const merged = await syncSkill(s, records);
          if (alive) setSkill((prev) => mergeSkill(prev, merged));
          void store.write(SKILL_KEY, merged);
        } catch {
          // offline: the device copy stands
        }
      }
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

  // push what the server lacks, a moment after a puzzle finishes
  useEffect(() => {
    if (!session || !skill.some((r) => !r.synced)) return;
    const handle = setTimeout(() => {
      syncSkill(session, skill)
        .then((merged) => {
          setSkill((prev) => mergeSkill(prev, merged));
          void store.write(SKILL_KEY, merged);
        })
        .catch(() => undefined);
    }, 800);
    return () => clearTimeout(handle);
  }, [session, skill]);

  /** One record per puzzle: a repeated settlement of the same day or round changes nothing. */
  function onSkill(record: SkillRecord) {
    setSkill((prev) => {
      if (prev.some((r) => r.id === record.id)) return prev;
      const next = [...prev, record];
      void store.write(SKILL_KEY, next);
      return next;
    });
  }

  if ((!fontsLoaded && !fontError) || !settingsReady) return <View style={styles.root} />;

  return (
    <SafeAreaView style={styles.root}>
      {tab === 'today' ? <MiddlesScreen session={session} palette={palette} soundOn={settings.sound} onOpenSettings={() => setSheet('settings')} onSkill={onSkill} /> : null}
      {tab === 'chain' ? <ChainScreen palette={palette} soundOn={settings.sound} /> : null}
      {tab === 'practice' ? <PracticeScreen palette={palette} soundOn={settings.sound} records={skill} onSkill={onSkill} /> : null}
      {tab === 'skill' ? <SkillScreen palette={palette} records={skill} /> : null}

      <View style={styles.tabs}>
        {(
          [
            ['today', texts.tabToday],
            ['chain', texts.tabChain],
            ['practice', texts.tabPractice],
            ['skill', texts.tabSkill],
          ] as const
        ).map(([key, label]) => (
          <Pressable key={key} onPress={() => setTab(key)} style={styles.tab} testID={`tab-${key}`}>
            <Text style={[styles.tabLabel, tab === key && styles.tabActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

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
    tabs: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: p.border },
    tab: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
    tabLabel: { fontFamily: fonts.textMedium, fontSize: type.small.fontSize, color: p.muted, letterSpacing: 0.4 },
    tabActive: { color: p.accent },
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
