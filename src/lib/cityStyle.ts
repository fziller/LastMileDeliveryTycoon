// OpenFreeMap uses the OpenMapTiles schema: park, water, building,
// transportation and transportation_name are present in its Positron style.
export const cityStyle = {
  version: 8 as const,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    city: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      attribution: '© OpenMapTiles © OpenStreetMap contributors',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#CBEAA0' } },
    { id: 'woodland', type: 'fill', source: 'city', 'source-layer': 'landcover', filter: ['==', 'class', 'wood'], paint: { 'fill-color': '#9BD36B', 'fill-opacity': 0.8 } },
    { id: 'parks', type: 'fill', source: 'city', 'source-layer': 'park', paint: { 'fill-color': '#88C958', 'fill-opacity': 0.85 } },
    { id: 'sports-grounds', type: 'fill', source: 'city', 'source-layer': 'landuse', filter: ['in', 'class', 'stadium', 'pitch', 'playground', 'track'], paint: { 'fill-color': '#ABD78B' } },
    { id: 'water', type: 'fill', source: 'city', 'source-layer': 'water', paint: { 'fill-color': '#A8D9E8' } },
    { id: 'building-shadows', type: 'fill', source: 'city', 'source-layer': 'building', minzoom: 14, paint: { 'fill-color': '#405438', 'fill-opacity': 0.2, 'fill-translate': [2, 3] } },
    // Height is only a visual hint, not a reliable building-type classification.
    { id: 'buildings', type: 'fill', source: 'city', 'source-layer': 'building', minzoom: 13, paint: { 'fill-color': ['case', ['>=', ['coalesce', ['get', 'render_height'], 0], 18], '#5796A5', ['>=', ['coalesce', ['get', 'render_height'], 0], 10], '#BA6E72', '#DA9C48'], 'fill-outline-color': '#98764E' } },
    { id: 'street-edges', type: 'line', source: 'city', 'source-layer': 'transportation', filter: ['in', 'class', 'minor', 'service', 'residential', 'tertiary', 'secondary', 'primary', 'trunk', 'motorway'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#F4E9B8', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3, 16, 13, 19, 26] } },
    { id: 'streets', type: 'line', source: 'city', 'source-layer': 'transportation', filter: ['in', 'class', 'minor', 'service', 'residential', 'tertiary', 'secondary', 'primary', 'trunk', 'motorway'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#666665', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 16, 9, 19, 21] } },
    { id: 'street-markings', type: 'line', source: 'city', 'source-layer': 'transportation', minzoom: 15, filter: ['in', 'class', 'primary', 'secondary', 'tertiary', 'trunk', 'motorway'], paint: { 'line-color': '#FFFFFF', 'line-width': 1, 'line-dasharray': [3, 4] } },
    { id: 'street-names', type: 'symbol', source: 'city', 'source-layer': 'transportation_name', minzoom: 15, layout: { 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name:de'], ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': 11 }, paint: { 'text-color': '#555B56', 'text-halo-color': '#FFFDF8', 'text-halo-width': 1.5 } },
    { id: 'places-dot', type: 'circle', source: 'city', 'source-layer': 'poi', minzoom: 14, filter: ['all', ['has', 'name'], ['in', 'class', 'railway', 'park', 'school', 'hospital', 'library', 'stadium', 'attraction', 'town_hall', 'swimming']], paint: { 'circle-radius': 4, 'circle-color': '#438D83', 'circle-stroke-color': '#FFFDF8', 'circle-stroke-width': 1.5 } },
    { id: 'places-label', type: 'symbol', source: 'city', 'source-layer': 'poi', minzoom: 14, filter: ['all', ['has', 'name'], ['in', 'class', 'railway', 'park', 'school', 'hospital', 'library', 'stadium', 'attraction', 'town_hall', 'swimming']], layout: { 'text-field': ['coalesce', ['get', 'name:de'], ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-max-width': 10 }, paint: { 'text-color': '#30544D', 'text-halo-color': '#FFFDF8', 'text-halo-width': 1.3 } },
  ],
};

export const cityStyleWithoutPlaces = {
  ...cityStyle,
  layers: cityStyle.layers.filter((layer) => layer.id !== 'places-dot' && layer.id !== 'places-label'),
};
