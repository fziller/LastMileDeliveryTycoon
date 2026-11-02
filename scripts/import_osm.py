"""Extract address points from a Geofabrik PBF (requires pyosmium)."""
import json
import sys
import osmium


class Addresses(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.items = {}

    def add(self, obj, lon, lat, kind):
        street, number = obj.tags.get('addr:street'), obj.tags.get('addr:housenumber')
        postcode = sys.argv[3] if len(sys.argv) > 3 else None
        if not street or not number or (obj.tags.get('addr:postcode') != postcode if postcode else not (52.407 <= lat <= 52.438 and 13.455 <= lon <= 13.488)):
            return
        key = (street.casefold().strip(), number.casefold().strip(), obj.tags.get('addr:city', '').casefold().strip()) if postcode else (street.casefold().strip(), number.casefold().strip())
        self.items.setdefault(key, {'id': f'{kind}/{obj.id}', 'name': f'{street} {number}',
                                    'address': f'{street} {number}', 'lat': lat, 'lon': lon})

    def node(self, node):
        if node.location.valid():
            self.add(node, node.location.lon, node.location.lat, 'node')

    def way(self, way):
        if not way.tags.get('addr:street') or not way.tags.get('addr:housenumber'):
            return
        points = [n.location for n in way.nodes if n.location.valid()]
        if points:
            self.add(way, sum(p.lon for p in points) / len(points),
                     sum(p.lat for p in points) / len(points), 'way')


handler = Addresses()
handler.apply_file(sys.argv[1], locations=True)
with open(sys.argv[2], 'w', encoding='utf-8') as output:
    json.dump(list(handler.items.values()), output, ensure_ascii=False, separators=(',', ':'))
print(f'{len(handler.items)} addresses')
