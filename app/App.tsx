import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { Settings } from './src/game/store';
import { GameScreen } from './src/screens/GameScreen';
import { SetupScreen } from './src/screens/SetupScreen';
import { texts } from './src/texts';
import { colors, spacing } from './src/theme';

type Screen = 'setup' | 'game';

const defaultSettings: Settings = { humanSide: 'white', strength: 'apprentice', assist: 3 };

export default function App() {
  const [screen, setScreen] = useState<Screen>('setup');
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topBar}>
        <Text style={styles.title}>{texts.appTitle}</Text>
        <Pressable onPress={() => setScreen('setup')} testID="nav-setup">
          <Text style={styles.nav}>{texts.newGame}</Text>
        </Pressable>
      </View>
      {screen === 'setup' ? (
        <SetupScreen
          initial={settings}
          onStart={(s) => {
            setSettings(s);
            setScreen('game');
          }}
        />
      ) : (
        <GameScreen settings={settings} onNewGame={() => setScreen('setup')} />
      )}
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 18, fontWeight: '700', color: colors.ink, letterSpacing: 2 },
  nav: { color: colors.accent, fontWeight: '600' },
});
