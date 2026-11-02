import { useCallback, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Updates from 'expo-updates';

export function UpdateSnackbar() {
  const { isUpdatePending } = Updates.useUpdates();
  const [dismissed, setDismissed] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const checking = useRef(false);
  const lastCheck = useRef(0);

  useFocusEffect(useCallback(() => {
    if (!Updates.isEnabled || __DEV__) return;

    async function check() {
      if (checking.current || Date.now() - lastCheck.current < 60_000) return;
      checking.current = true;
      lastCheck.current = Date.now();
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable || update.isRollBackToEmbedded) await Updates.fetchUpdateAsync();
      } catch {
        // Update checks must never prevent the game from starting.
      } finally {
        checking.current = false;
      }
    }

    void check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => subscription.remove();
  }, []));

  async function restart() {
    if (restarting) return;
    setRestarting(true);
    try { await Updates.reloadAsync(); }
    catch {
      setRestarting(false);
      Alert.alert('Neustart fehlgeschlagen', 'Bitte starte die App später erneut.');
    }
  }

  if (!isUpdatePending || dismissed) return null;
  return (
    <View accessibilityLiveRegion="polite" style={styles.bar}>
      <View style={styles.icon}><Text style={styles.iconText}>↻</Text></View>
      <View style={styles.copy}><Text style={styles.title}>Frische Lieferung!</Text><Text style={styles.message}>Ein Update ist bereit.</Text></View>
      <Pressable accessibilityRole="button" disabled={restarting} onPress={() => void restart()} style={styles.action}><Text style={styles.actionText}>{restarting ? 'Startet …' : 'Neustart'}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Update-Hinweis schließen" onPress={() => setDismissed(true)} hitSlop={8} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', bottom: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 16, backgroundColor: '#123D3A', shadowColor: '#283746', shadowOpacity: 0.24, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
  icon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#DCEFE6' },
  iconText: { color: '#006B5F', fontSize: 25, fontWeight: '800' },
  copy: { flex: 1 },
  title: { color: '#FFFDF8', fontSize: 13, fontWeight: '800' },
  message: { color: '#DCEFE6', fontSize: 12 },
  action: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 12, backgroundColor: '#F39A4A' },
  actionText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  close: { minWidth: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFFDF8', fontSize: 24 },
});
