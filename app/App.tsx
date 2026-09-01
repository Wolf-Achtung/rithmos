import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { initialPosition } from '../engine/board';
import { mebben } from '../engine/rules/mebben';

export default function App() {
  const pos = initialPosition();
  return (
    <View style={styles.container}>
      <Text>Rithmos, Regelfassung {mebben.name}, {pos.pieces.length} Steine.</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});
