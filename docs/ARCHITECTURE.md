# Architektur

Expo Router zeigt Menü und Spielansicht. AsyncStorage hält einen lokalen Spielstand. `src/lib/osm.ts` lädt Adressen und fragt OSRM ab. `src/lib/simulation.ts` berechnet Fahrzeugposition und Zustellungen unabhängig von React.
