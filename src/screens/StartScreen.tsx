import { useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Alert, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { fetchStops } from '../lib/osm';
import { saveGame, loadGame } from '../lib/storage';
import { areas } from '../lib/areas';
import { UpdateSnackbar } from '../components/UpdateSnackbar';

export default function StartScreen() {
  const [city, setCity] = useState('Berlin-Gropiusstadt');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSave, setHasSave] = useState<boolean | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    loadGame().then((g) => { if (active) setHasSave(!!g); }).catch(() => {
      if (active) setError('Der Spielstand konnte nicht geladen werden.');
    });
    return () => { active = false; };
  }, []));

  async function createGame() {
    setLoading(true);
    setError(null);
    try {
      const stops = await fetchStops(city.trim(), 5);
      const game = { stops, order: stops.map((s) => s.id), city: city.trim(), createdAt: Date.now(), day: 1 };
      await saveGame(game);
      router.push('/game');
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch stops');
    } finally {
      setLoading(false);
    }
  }

  function newGame() {
    if (hasSave === null) return;
    if (!hasSave) {
      void createGame();
      return;
    }
    Alert.alert('Spielstand überschreiben?', 'Das bisherige Spiel wird durch ein neues ersetzt.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Überschreiben', style: 'destructive', onPress: () => void createGame() },
    ]);
  }

  async function continueGame() {
    router.push('/game');
  }

  async function reset() {
    await (await import('../lib/storage')).clearGame();
    setHasSave(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.title}>LAST MILE</Text>
        <Text style={styles.titleSecond}>DELIVERY TYCOON</Text>
        <Text style={styles.sub}>Dein Paketdienst. Deine Stadt.</Text>
      </View>
      <View style={styles.illustrationWrap}>
        <Image source={require('../../assets/menu-city.png')} style={styles.illustration} resizeMode="cover" accessibilityLabel="Illustrierte Stadtkarte mit Lieferwagen" />
      </View>
      <View style={styles.actions}>
      <Text style={styles.areaLabel}>Startgebiet</Text>
      {areas.map((area) => <Pressable key={area.city} accessibilityRole="radio" accessibilityState={{ checked: city === area.city }} onPress={() => setCity(area.city)} style={[styles.area, city === area.city && styles.areaSelected]}><Text style={styles.areaText}>{city === area.city ? '●' : '○'}  {area.label}</Text></Pressable>)}
      {loading || hasSave === null ? <ActivityIndicator color="#F39A4A" /> : <>
      {hasSave && <Pressable accessibilityRole="button" style={styles.primary} onPress={continueGame}><Text style={styles.primaryText}>▷  Spiel fortsetzen</Text></Pressable>}
      <Pressable accessibilityRole="button" style={hasSave ? styles.secondary : styles.primary} onPress={newGame}><Text style={styles.primaryText}>＋  Neues Spiel</Text></Pressable>
      </>}
      {hasSave && <Pressable accessibilityRole="button" style={styles.delete} onPress={() => Alert.alert('Spielstand löschen?', 'Das kann nicht rückgängig gemacht werden.', [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: () => void reset() },
      ])}><Text style={styles.deleteText}>Spielstand löschen</Text></Pressable>}
      {error && <Text style={styles.error}>{error}</Text>}
      <Text style={styles.note}>
        Adressen: © OpenStreetMap-Mitwirkende, Geofabrik-Extrakte. Routing: OSRM-Demoserver.
      </Text>
      </View>
      </ScrollView>
      <UpdateSnackbar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F5ED' },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 16, justifyContent: 'space-between', gap: 24 },
  hero: { alignItems: 'center', gap: 4 },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -1, color: '#E85D0C', textAlign: 'center' },
  titleSecond: { fontSize: 19, fontWeight: '800', letterSpacing: 3, color: '#123D3A', textAlign: 'center' },
  sub: { fontSize: 15, color: '#68574C', textAlign: 'center', marginTop: 6 },
  illustrationWrap: { width: '100%', maxWidth: 480, aspectRatio: 4 / 3, alignSelf: 'center', borderRadius: 24, borderWidth: 3, borderColor: '#FFFDF8', overflow: 'hidden', backgroundColor: '#E3F2E8' },
  illustration: { width: '100%', height: '100%' },
  actions: { gap: 10 },
  areaLabel: { fontSize: 14, fontWeight: '700', color: '#123D3A' },
  area: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#FFFDF8' },
  areaSelected: { backgroundColor: '#DCEFE6' },
  areaText: { color: '#123D3A', fontWeight: '600' },
  primary: { backgroundColor: '#FF6B2B', minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondary: { backgroundColor: '#006B5F', minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  delete: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: '#75818B', fontSize: 12 },
  error: { color: '#b00', textAlign: 'center' },
  note: { fontSize: 11, color: '#888', textAlign: 'center', marginTop: 16 },
});
