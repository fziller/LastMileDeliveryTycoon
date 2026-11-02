# OSM-Daten

Der Datensatz stammt aus dem Geofabrik-Berlin-Extrakt vom 31. Oktober 2026. `scripts/import_osm.py` extrahiert Adressen aus Nodes und Ways innerhalb eines rechteckigen Ausschnitts. Er benötigt pyosmium und eine lokale PBF-Datei. Die Daten stehen unter der Open Database License: https://www.openstreetmap.org/copyright. © OpenStreetMap-Mitwirkende.

Der Ausschnitt ist keine exakte Verwaltungsgrenze. Relations werden nicht importiert. Haltepunkte und Erreichbarkeit werden erst bei der Routenanfrage geprüft. OSRM und Kartenkacheln benötigen Internetzugang.

Für die PLZ-Datensätze stammen die Adressen aus den Berlin- und Sachsen-Anhalt-Extrakten von Geofabrik. Der Import berücksichtigt ausschließlich Nodes und Ways mit expliziter `addr:postcode`, `addr:street` und `addr:housenumber`:

```sh
python scripts/import_osm.py sachsen-anhalt.osm.pbf src/lib/addresses-38889.json 38889
python scripts/import_osm.py sachsen-anhalt.osm.pbf src/lib/addresses-39261.json 39261
python scripts/import_osm.py berlin.osm.pbf src/lib/addresses-12487.json 12487
python scripts/import_osm.py berlin.osm.pbf src/lib/addresses-12489.json 12489
python scripts/import_osm.py sachsen-anhalt.osm.pbf src/lib/addresses-39264.json 39264
python scripts/import_osm.py sachsen-anhalt.osm.pbf src/lib/addresses-38895.json 38895
python scripts/import_osm.py sachsen-anhalt.osm.pbf src/lib/addresses-06502.json 06502
```

Die Datensätze sind nicht vollständig und enthalten keine PLZ-Grenzen. Die Auswahl der Zentrale ist daher nur in der Nähe einer erfassten Adresse möglich. 39261 deckt nicht alle Ortsteile von Zerbst/Anhalt ab; einige haben die PLZ 39264.

12489, 39264, 38895 und 06502 stehen als kaufbare Erweiterungen für ihre jeweiligen Startgebiete bereit. Eine PLZ kann weitere Orte außerhalb der genannten Ortsteile enthalten; insbesondere umfasst 06502 auch Thale. Die Daten sind weder auf Gemeindegrenzen noch auf Nachbarschaft geprüft.

Die Karte verwendet OpenFreeMap-Vektorkacheln im OpenMapTiles-Schema. `src/lib/cityStyle.ts` definiert den Kartenstil; OpenFreeMap stellt den öffentlichen Dienst ohne API-Key bereit. Attribution: © OpenMapTiles und © OpenStreetMap-Mitwirkende. Der öffentliche Dienst bietet keine Verfügbarkeitsgarantie.
