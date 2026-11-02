import { useEffect, useRef, useState } from 'react';
import { View, Text, Button, Pressable, StyleSheet, FlatList, ScrollView, ActivityIndicator, AppState, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Map, Camera, GeoJSONSource, Layer, Marker } from '@maplibre/maplibre-react-native';
import { loadGame, saveGame } from '../lib/storage';
import { fetchRoute, reachableStops, snapDepot, RouteResult } from '../lib/osm';
import { Stop, GameState } from '../types';
import { simulate } from '../lib/simulation';
import { cityStyle, cityStyleWithoutPlaces } from '../lib/cityStyle';
import { expansions, getArea } from '../lib/areas';
import { AREA_PRICE, CAPACITY_PRICE, EFFICIENCY_PRICE, balance, buy, capacity, completeDay, costPerKm, reward } from '../lib/economy';



const euros = (cents: number) => `${(cents / 100).toFixed(2)} €`;

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(1);
  const [finished, setFinished] = useState(false);
  const [delivered, setDelivered] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const activeRef = useRef<GameState | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [depotCandidate, setDepotCandidate] = useState<[number, number] | null>(null);
  const [showPlaces, setShowPlaces] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [section, setSection] = useState<'game' | 'upgrades' | 'areas'>('game');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' || !timerRef.current || !activeRef.current) return;
      clearInterval(timerRef.current);
      timerRef.current = null;
      setRunning(false);
      const updated = { ...activeRef.current, elapsed: elapsedRef.current };
      activeRef.current = updated;
      setGame(updated);
      void saveGame(updated).catch(() => alert('Tourfortschritt konnte nicht gespeichert werden.'));
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!game?.depot || game.activeRoute || game.completedRoute || game.choosingOrders) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      setRoute(null);
      setPreviewError('');
      setRouteLoading(true);
      const byId = Object.fromEntries(game.stops.map((stop) => [stop.id, stop]));
      const stops = game.order.map((id) => byId[id]);
      void fetchRoute([game.depot!, ...stops, game.depot!]).then((result) => {
        if (!cancelled) setRoute(result);
      }).catch((error: unknown) => {
        if (!cancelled) setPreviewError(error instanceof Error ? error.message : 'Route konnte nicht berechnet werden.');
      }).finally(() => { if (!cancelled) setRouteLoading(false); });
    }, 400);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [game?.depot, game?.order, game?.stops, game?.activeRoute, game?.completedRoute, game?.choosingOrders]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    loadGame().then((g) => {
      if (!g) router.replace('/');
      else {
        setGame(g);
        if (g.activeRoute?.legs) {
          setRoute(g.activeRoute);
          setProgress(g.elapsed ?? 0);
          setDelivered(simulate(g.activeRoute, g.elapsed ?? 0).delivered);
        }
        if (g.completedRoute?.legs) {
          setRoute(g.completedRoute);
          setFinished(true);
          setDelivered(g.order.length);
        }
      }
      setLoading(false);
    });
  }, []);

  if (loading || !game) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const stopsById = Object.fromEntries(game.stops.map((s) => [s.id, s]));
  const orderedStops = game.order.map((id) => stopsById[id]).filter(Boolean) as Stop[];
  const center: [number, number] = orderedStops.length
    ? [game.depot?.lon ?? getArea(game.city).center[0], game.depot?.lat ?? getArea(game.city).center[1]]
    : getArea(game.city).center;

  function move(idx: number, dir: -1 | 1) {
    if (running || routeLoading || finished || game?.activeRoute) return;
    const next = [...game!.order];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    const updated = { ...game!, order: next };
    setGame(updated);
    saveGame(updated);
    setRoute(null);
    setFinished(false);
    setDelivered(0);
  }

  async function drive() {
    if (orderedStops.length < 1) return;
    setRouteLoading(true);
    setFinished(false);
    if (!game?.activeRoute) setProgress(0);
    try {
      if (!game?.depot) throw new Error('Bitte ein neues Spiel starten: Der alte Spielstand hat keine Zentrale.');
      const r = game.activeRoute ?? route;
      if (!r) throw new Error('Bitte warte auf die Routenvorschau.');
      if (r.coords.length < 2) throw new Error('Die Route enthält keine fahrbare Geometrie.');
      setRoute(r);
      let elapsed = game.elapsed ?? 0;
      // The clock starts only after the player starts or resumes a tour.
      let last = Date.now();
      const active = { ...game, activeRoute: r, elapsed };
      await saveGame(active);
      elapsedRef.current = elapsed;
      activeRef.current = active;
      setGame(active);
      if (AppState.currentState !== 'active') return;
      setExpanded(false);
      setRunning(true);
      timerRef.current = setInterval(() => {
        const now = Date.now();
        elapsed += (now - last) / 1000 * 30 * speedRef.current;
        elapsedRef.current = elapsed;
        last = now;
        const state = simulate(r, elapsed);
        setProgress(elapsed);
        setDelivered(state.delivered);
        if (state.finished) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          activeRef.current = null;
          const completed = completeDay(game!, r);
          void saveGame(completed).then(() => {
            setGame(completed);
            setFinished(true);
            setRunning(false);
          }).catch(() => {
            setRunning(false);
            alert('Tagesabschluss konnte nicht gespeichert werden. Bitte die Tour erneut starten.');
          });
        }
      }, 40);
    } catch (e: any) {
      alert(e?.message || 'Route failed');
    } finally {
      setRouteLoading(false);
    }
  }

  async function selectDepot() {
    if (game?.depot || routeLoading || !depotCandidate) return;
    setRouteLoading(true);
    try {
      const [lon, lat] = depotCandidate;
      const depot = await snapDepot(lon, lat, game!.city);
      const stops = await reachableStops(depot, game!.city, game!.unlockedAreas);
      const updated = { ...game!, depot, stops, order: [], choosingOrders: true };
      await saveGame(updated);
      setGame(updated);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Standort konnte nicht geprüft werden.');
    } finally {
      setRouteLoading(false);
    }
  }

  const vehicle = route ? simulate(route, finished ? Number.MAX_SAFE_INTEGER : progress) : null;
  const vehicleCoord = vehicle?.position;

  const distanceKm = route ? route.distanceM / 1000 : 0;
  const revenue = orderedStops.slice(0, delivered).reduce((sum, stop) => sum + reward(stop), 0) / 100;
  const cost = (route ? simulate(route, finished ? Number.MAX_SAFE_INTEGER : progress).distance / 1000 : 0) * costPerKm(game) / 100;
  const profit = revenue - cost;

  async function pause() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRunning(false);
    if (game && route) {
      const updated = { ...game, activeRoute: route, elapsed: elapsedRef.current };
      activeRef.current = updated;
      try { await saveGame(updated); setGame(updated); }
      catch { alert('Der Tourfortschritt konnte nicht gespeichert werden.'); }
    }
  }

  async function nextDay() {
    if (routeLoading) return;
    setRouteLoading(true);
    try {
      if (!game!.depot) throw new Error('Zentrale fehlt.');
      const stops = await reachableStops(game!.depot, game!.city, game!.unlockedAreas);
      const updated = { ...game!, stops, order: [], choosingOrders: true, day: (game!.day ?? 1) + 1, completedRoute: undefined, dayResult: undefined };
      await saveGame(updated);
      setGame(updated);
      setRoute(null);
      setFinished(false);
      setDelivered(0);
      setProgress(0);
      setExpanded(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Der nächste Spieltag konnte nicht gespeichert werden.');
    } finally {
      setRouteLoading(false);
    }
  }

  async function updateGame(updated: GameState) {
    if (routeLoading) return;
    setRouteLoading(true);
    try { await saveGame(updated); setGame(updated); }
    catch { alert('Spielstand konnte nicht gespeichert werden.'); }
    finally { setRouteLoading(false); }
  }

  function toggleOrder(stop: Stop) {
    if (!game || routeLoading) return;
    const selected = game.order.includes(stop.id);
    if (!selected && game.order.length >= capacity(game)) return;
    const order = selected ? game.order.filter((id) => id !== stop.id) : [...game.order, stop.id];
    void updateGame({ ...game, order });
  }

  function purchase(item: 'capacity' | 'efficiency' | 'area', area?: string) {
    if (!game || routeLoading) return;
    const updated = buy(game, item, area);
    if (updated === game) return;
    const price = balance(game) - balance(updated);
    Alert.alert('Kauf bestätigen?', `Kosten: ${euros(price)}. Danach bleiben ${euros(balance(updated))}.`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Kaufen', onPress: () => void updateGame(updated) },
    ]);
  }

  const routeShape = route
    ? { type: 'Feature', geometry: { type: 'LineString', coordinates: route.coords }, properties: {} }
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <Map style={styles.map} mapStyle={(showPlaces ? cityStyle : cityStyleWithoutPlaces) as any} onPress={(event) => {
          if (!game.depot && !routeLoading) setDepotCandidate(event.nativeEvent.lngLat);
        }}>
          <Camera initialViewState={{ center, zoom: game.depot ? 15 : getArea(game.city).zoom }} />
          {game.depot && <Marker lngLat={[game.depot.lon, game.depot.lat]}><View style={styles.depot}><Text style={styles.depotText}>⌂</Text></View></Marker>}
          {!game.depot && depotCandidate && <Marker lngLat={depotCandidate}><View style={styles.depot}><Text style={styles.depotText}>⌂</Text></View></Marker>}
          {game.depot && (game.choosingOrders ? game.stops : orderedStops).map((stop, index) => <Marker key={stop.id} lngLat={[stop.lon, stop.lat]}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${stop.name}, ${euros(reward(stop))}`} disabled={!game.choosingOrders} onPress={() => toggleOrder(stop)} style={[styles.stop, game.choosingOrders && !game.order.includes(stop.id) && styles.unselectedStop, !game.choosingOrders && index < delivered && styles.delivered]}><Text style={styles.stopText}>{game.choosingOrders ? (game.order.includes(stop.id) ? '✓' : '+') : index + 1}</Text></Pressable>
          </Marker>)}
          {routeShape && (
            <GeoJSONSource id="route" data={routeShape as any}>
              <Layer id="route-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#F39A4A', 'line-width': 5 }} />
            </GeoJSONSource>
          )}
          {vehicleCoord && (
            <Marker lngLat={vehicleCoord}>
              <View style={[styles.vehicle, { transform: [{ rotate: `${vehicle?.bearing ?? 0}deg` }] }]}>
                <View style={[styles.vehicleWheel, styles.wheelFrontLeft]} />
                <View style={[styles.vehicleWheel, styles.wheelFrontRight]} />
                <View style={[styles.vehicleWheel, styles.wheelBackLeft]} />
                <View style={[styles.vehicleWheel, styles.wheelBackRight]} />
                <View style={styles.vehicleWindow} />
                <View style={styles.vehicleRoof} />
              </View>
            </Marker>
          )}
        </Map>
        <Pressable accessibilityRole="switch" accessibilityLabel="Orte anzeigen" accessibilityState={{ checked: showPlaces }} onPress={() => setShowPlaces((shown) => !shown)} style={[styles.placesToggle, { top: Math.max(insets.top, 8) + 28 }]}><Text style={styles.placesText}>Orte {showPlaces ? 'an' : 'aus'}</Text></Pressable>
        <Text style={[styles.attribution, { top: Math.max(insets.top, 8) }]}>© OpenMapTiles · © OpenStreetMap-Mitwirkende</Text>
      </View>

      <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.handle} />
        {section !== 'game' ? <>
          <Text style={styles.eyebrow}>KONTOSTAND · {euros(balance(game))}</Text>
          <Text style={styles.h}>{section === 'upgrades' ? 'Fahrzeug-Upgrades' : 'Deine Gebiete'}</Text>
          <ScrollView style={styles.shopList}>
            {section === 'upgrades' ? <>
              <View style={styles.shopCard}><Text style={styles.shopTitle}>Mehr Laderaum</Text><Text>Kapazität: 5 → 8 Pakete</Text><Pressable accessibilityRole="button" disabled={routeLoading || !!game.capacityUpgraded || balance(game) < CAPACITY_PRICE} onPress={() => purchase('capacity')} style={[styles.shopButton, (routeLoading || game.capacityUpgraded || balance(game) < CAPACITY_PRICE) && styles.disabled]}><Text style={styles.primaryText}>{game.capacityUpgraded ? 'Bereits ausgebaut' : `Ausbauen · ${euros(CAPACITY_PRICE)}`}</Text></Pressable></View>
              <View style={styles.shopCard}><Text style={styles.shopTitle}>Effizienter Antrieb</Text><Text>Fahrtkosten: 0,40 € → 0,30 € / km</Text><Pressable accessibilityRole="button" disabled={routeLoading || !!game.efficiencyUpgraded || balance(game) < EFFICIENCY_PRICE} onPress={() => purchase('efficiency')} style={[styles.shopButton, (routeLoading || game.efficiencyUpgraded || balance(game) < EFFICIENCY_PRICE) && styles.disabled]}><Text style={styles.primaryText}>{game.efficiencyUpgraded ? 'Bereits ausgebaut' : `Ausbauen · ${euros(EFFICIENCY_PRICE)}`}</Text></Pressable></View>
            </> : <>
              <View style={styles.shopCard}><Text style={styles.shopTitle}>{getArea(game.city).label}</Text><Text>Aktiv · Startgebiet</Text></View>
              {expansions.filter((area) => area.city === game.city).map((area) => { const unlocked = game.unlockedAreas?.includes(area.id); return <View key={area.id} style={styles.shopCard}><Text style={styles.shopTitle}>{area.label}</Text><Text>{unlocked ? 'Aktiv · Ab dem nächsten Tag verfügbar' : 'Gesperrt · Neue Lieferziele'}</Text><Pressable accessibilityRole="button" disabled={routeLoading || unlocked || balance(game) < AREA_PRICE} onPress={() => purchase('area', area.id)} style={[styles.shopButton, (routeLoading || unlocked || balance(game) < AREA_PRICE) && styles.disabled]}><Text style={styles.primaryText}>{unlocked ? 'Freigeschaltet' : `Freischalten · ${euros(AREA_PRICE)}`}</Text></Pressable></View>; })}
              {!expansions.some((area) => area.city === game.city) && <Text>Für dieses Startgebiet ist noch keine Erweiterung vorbereitet.</Text>}
            </>}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={() => setSection('game')} style={styles.menu}><Text style={styles.menuText}>Zurück zur Tour</Text></Pressable>
        </> : <>
        <Text style={styles.eyebrow}>{finished ? 'FEIERABEND' : game.depot ? `TAG ${game.day ?? 1} · ${game.city.toUpperCase()}` : 'DEIN ERSTER SCHRITT'}</Text>
        <Text style={styles.h}>{finished ? 'Gut geliefert!' : game.choosingOrders ? 'Aufträge auswählen' : game.depot ? 'Deine Tour' : 'Hier geht’s los'}</Text>
        {(!game.depot || finished || running) && <Text style={styles.subheading}>{finished ? `${delivered} Pakete zugestellt` : running ? `${delivered} von ${orderedStops.length} Paketen zugestellt` : 'Tippe auf eine Straße, um deine Zentrale zu gründen.'}</Text>}
        {finished && <View style={styles.balanceCard}><Text style={styles.balanceLabel}>DEIN KONTOSTAND</Text><Text style={styles.balanceValue}>{euros(balance(game))}</Text>{game.dayResult ? <><Text style={styles.balanceProfit}>Tagesgewinn: {euros(game.dayResult.profitCents)}</Text><Text style={styles.balanceDetail}>Einnahmen {euros(game.dayResult.revenueCents)} − Fahrtkosten {euros(game.dayResult.costCents)}</Text></> : <Text style={styles.balanceDetail}>Frühere Tagesgewinne wurden nicht gespeichert.</Text>}</View>}
        {!game.depot && <Pressable accessibilityRole="button" disabled={!depotCandidate || routeLoading} onPress={selectDepot} style={[styles.primary, (!depotCandidate || routeLoading) && styles.disabled]}><Text style={styles.primaryText}>{routeLoading ? 'Standort wird geprüft …' : 'Standort bestätigen  →'}</Text></Pressable>}
        {game.choosingOrders && <>
          <Text style={styles.routeSummary}>{game.order.length} / {capacity(game)} Pakete · {euros(orderedStops.reduce((sum, stop) => sum + reward(stop), 0))} Einnahmen</Text>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.expandButton}><Text style={styles.expandText}>{expanded ? 'Aufträge schließen' : `Alle ${game.stops.length} Aufträge anzeigen`}</Text></Pressable>
          {expanded && <FlatList data={game.stops} style={styles.stopList} keyExtractor={(stop) => stop.id} renderItem={({ item }) => { const selected = game.order.includes(item.id); return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: routeLoading || (!selected && game.order.length >= capacity(game)) }} onPress={() => toggleOrder(item)} style={styles.row}><Text style={styles.listNumber}>{selected ? '✓' : '+'}</Text><Text style={styles.rowText}>{item.name}</Text><Text style={styles.expandText}>{euros(reward(item))}</Text></Pressable>; }} />}
          <Pressable accessibilityRole="button" disabled={routeLoading || game.order.length < 1} onPress={() => { setExpanded(false); void updateGame({ ...game, choosingOrders: false }); }} style={[styles.primary, (routeLoading || game.order.length < 1) && styles.disabled]}><Text style={styles.primaryText}>Tour planen →</Text></Pressable>
        </>}
        {!!game.depot && !game.choosingOrders && !finished && !running && <>
          <Text style={styles.routeSummary}>{route ? `${distanceKm.toFixed(1)} km   ·   ca. ${Math.ceil(route.durationS / 60)} Min.   ·   ${euros(Math.round(distanceKm * costPerKm(game)))}` : routeLoading ? 'Route wird berechnet …' : 'Routenvorschau'}</Text>
          {!game.activeRoute && <Pressable accessibilityRole="button" disabled={routeLoading} onPress={() => { setRoute(null); void updateGame({ ...game, choosingOrders: true }); }} style={styles.menu}><Text style={styles.menuText}>Aufträge ändern</Text></Pressable>}
          {!expanded && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stopStrip}>
            {orderedStops.map((stop, index) => <View key={stop.id} style={styles.stopChip}><Text style={styles.chipNumber}>{index + 1}</Text><Text numberOfLines={1} style={styles.chipText}>{stop.name}</Text></View>)}
          </ScrollView>}
          <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={expanded ? 'Adressliste schließen' : `Alle ${orderedStops.length} Adressen anzeigen`} onPress={() => setExpanded(!expanded)} style={styles.expandButton}>
            <Text style={styles.expandText}>{expanded ? 'Tour 1 · Adressen schließen' : `Alle ${orderedStops.length} Adressen`}  {expanded ? '⌄' : '⌃'}</Text>
          </Pressable>
        </>}
        {!!game.depot && !game.choosingOrders && !finished && !running && expanded && <FlatList
          data={orderedStops}
          style={styles.stopList}
          keyExtractor={(s) => s.id}
          renderItem={({ item, index }) => (
            <View style={styles.row}>
              <Text style={styles.listNumber}>{index + 1}</Text>
              <Text style={styles.rowText}>{item.name} {index < delivered ? '✓' : ''}</Text>
              <View style={styles.btns}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${item.name} nach oben`} onPress={() => move(index, -1)} disabled={routeLoading || !!game.activeRoute || index === 0} style={styles.orderButton}><Text style={[styles.orderText, (routeLoading || !!game.activeRoute || index === 0) && styles.disabled]}>▲</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`${item.name} nach unten`} onPress={() => move(index, 1)} disabled={routeLoading || !!game.activeRoute || index === orderedStops.length - 1} style={styles.orderButton}><Text style={[styles.orderText, (routeLoading || !!game.activeRoute || index === orderedStops.length - 1) && styles.disabled]}>▼</Text></Pressable>
              </View>
            </View>
          )}
        />}
        {previewError ? <><Text>{previewError}</Text><Button title="Route erneut prüfen" onPress={() => setGame({ ...game, order: [...game.order] })} /></> : null}
        {!game.choosingOrders && (finished || running || !!game.depot) && <Pressable accessibilityRole="button" disabled={routeLoading || (!finished && !running && !route)} onPress={finished ? nextDay : running ? pause : drive} style={({ pressed }) => [styles.primary, (routeLoading || (!finished && !running && !route)) && styles.disabled, pressed && styles.pressed]}><Text style={styles.primaryText}>{routeLoading ? 'Einen Moment …' : finished ? 'Nächster Tag  →' : running ? 'Pause und speichern' : game.activeRoute ? 'Tour fortsetzen  →' : 'Tour starten  →'}</Text></Pressable>}
        {running && <View style={styles.btns}>{[1, 2, 5].map((value) => <Button key={value} title={`${value}×${speed === value ? ' ✓' : ''}`} onPress={() => { speedRef.current = value; setSpeed(value); }} />)}</View>}
        {route && (running || !!game.activeRoute) && !finished && (
          <View style={styles.stats}>
            <Text>Route: {distanceKm.toFixed(2)} km · Gefahren: {(vehicle!.distance / 1000).toFixed(2)} km</Text>
            {!game.activeRoute && !finished && <Text>Voraussichtliche Fahrtkosten: {euros(Math.round(distanceKm * costPerKm(game)))}</Text>}
            <Text>Fahrzeit: {(route.durationS / 60).toFixed(1)} min · Simulation: {(progress / 60).toFixed(1)} min</Text>
            <Text>Einnahmen: {finished && game.dayResult ? euros(game.dayResult.revenueCents) : `${revenue.toFixed(2)} €`} · Kosten: {finished && game.dayResult ? euros(game.dayResult.costCents) : `${cost.toFixed(2)} €`}</Text>
            <Text style={styles.profit}>Gewinn: {finished && game.dayResult ? euros(game.dayResult.profitCents) : `${profit.toFixed(2)} €`} · Konto: {euros(balance(game))}</Text>
            {finished && <Text>Tour abgeschlossen.</Text>}
          </View>
        )}
        {!running && !game.activeRoute && game.depot && <View style={styles.btns}><Pressable accessibilityRole="button" onPress={() => setSection('upgrades')} style={styles.shopLink}><Text style={styles.expandText}>Upgrades</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setSection('areas')} style={styles.shopLink}><Text style={styles.expandText}>Gebiete</Text></Pressable></View>}
        {!running && <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.menu}><Text style={styles.menuText}>Zurück zum Menü</Text></Pressable>}
        </>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F5ED' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  attribution: { position: 'absolute', right: 8, fontSize: 9, color: '#283746', backgroundColor: 'rgba(255,253,248,0.92)', paddingHorizontal: 5, paddingVertical: 3, borderRadius: 4 },
  placesToggle: { position: 'absolute', right: 8, minHeight: 44, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#FFFDF8', justifyContent: 'center', elevation: 3 },
  placesText: { color: '#30544D', fontSize: 12, fontWeight: '700' },
  panel: { paddingHorizontal: 20, paddingTop: 10, gap: 6, maxHeight: '67%', backgroundColor: '#FFFDF8', borderTopLeftRadius: 28, borderTopRightRadius: 28, shadowColor: '#283746', shadowOpacity: 0.12, shadowRadius: 14, elevation: 12 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 4, backgroundColor: '#DADDD5', marginBottom: 6 },
  eyebrow: { color: '#C96D2D', fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  h: { fontWeight: '800', fontSize: 24, color: '#283746' },
  subheading: { color: '#75818B', fontSize: 13, marginBottom: 4 },
  balanceCard: { backgroundColor: '#E3F2E8', padding: 14, borderRadius: 16, gap: 3 },
  balanceLabel: { color: '#53746A', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  balanceValue: { color: '#123D3A', fontSize: 26, fontWeight: '900' },
  balanceProfit: { color: '#006B5F', fontSize: 14, fontWeight: '800' },
  balanceDetail: { color: '#53746A', fontSize: 12 },
  routeSummary: { fontSize: 13, color: '#63746E', fontWeight: '600' },
  stopStrip: { gap: 8, paddingVertical: 6 },
  stopChip: { flexDirection: 'row', alignItems: 'center', gap: 7, maxWidth: 200, paddingRight: 12, paddingLeft: 5, paddingVertical: 5, borderRadius: 22, backgroundColor: '#F5F2EB' },
  chipNumber: { width: 24, height: 24, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', borderRadius: 12, backgroundColor: '#F39A4A', color: '#fff', fontWeight: '800', lineHeight: 24 },
  chipText: { flexShrink: 1, fontSize: 12, color: '#283746', fontWeight: '700' },
  expandButton: { minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0EEE7' },
  expandText: { color: '#365852', fontSize: 13, fontWeight: '700' },
  stopList: { flexGrow: 0, maxHeight: 220 },
  shopList: { flexGrow: 0, maxHeight: 340 },
  shopCard: { padding: 12, gap: 8, marginBottom: 8, borderRadius: 14, backgroundColor: '#F5F2EB' },
  shopTitle: { fontWeight: '800', color: '#283746', fontSize: 15 },
  shopButton: { backgroundColor: '#F39A4A', minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  shopLink: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0EEE7', borderRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8E4DB', minHeight: 46, gap: 8 },
  listNumber: { width: 26, height: 26, overflow: 'hidden', borderRadius: 13, textAlign: 'center', textAlignVertical: 'center', lineHeight: 26, backgroundColor: '#F39A4A', color: '#fff', fontWeight: '800' },
  rowText: { flex: 1, fontSize: 13, color: '#283746', fontWeight: '600' },
  orderButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  orderText: { color: '#38685F', fontSize: 14 },
  btns: { flexDirection: 'row', gap: 4 },
  stats: { marginTop: 8, gap: 2 },
  profit: { fontWeight: '700' },
  vehicle: { width: 18, height: 27, borderRadius: 5, backgroundColor: '#F58A32', borderWidth: 1.5, borderColor: '#A94D20', alignItems: 'center', paddingTop: 4, shadowColor: '#283746', shadowOpacity: 0.35, shadowRadius: 2, shadowOffset: { width: 1, height: 2 }, elevation: 3 },
  vehicleWheel: { position: 'absolute', width: 3, height: 6, backgroundColor: '#374046', borderRadius: 1 },
  wheelFrontLeft: { left: -3, top: 3 },
  wheelFrontRight: { right: -3, top: 3 },
  wheelBackLeft: { left: -3, bottom: 3 },
  wheelBackRight: { right: -3, bottom: 3 },
  vehicleWindow: { width: 12, height: 5, backgroundColor: '#487A80', borderRadius: 2 },
  vehicleRoof: { width: 10, height: 9, backgroundColor: '#FFAD5A', borderRadius: 2, marginTop: 2 },
  depot: { width: 24, height: 24, borderRadius: 8, backgroundColor: '#55B8AE', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  depotText: { color: '#fff', fontSize: 17, fontWeight: '800', lineHeight: 20 },
  stop: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F39A4A', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  delivered: { backgroundColor: '#65B67A' },
  unselectedStop: { backgroundColor: '#365852' },
  stopText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  primary: { backgroundColor: '#F39A4A', borderRadius: 15, minHeight: 49, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  menu: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  menuText: { color: '#75818B', fontSize: 12, fontWeight: '600' },
});
