"use client";

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import basemap from '@/data/basemap-style.json';
import { Temple, deityColors } from '@/lib/temples';

export type MapMode = 'world' | 'globe';
type Props = {
  temples: Temple[];
  onSelect: (temple: Temple) => void;
  selected: Temple | null;
  country: string;
  mode: MapMode;
  zoomCommand: { value: number; kind: string };
};

function templeFeatures(temples: Temple[]) {
  return {
    type: 'FeatureCollection' as const,
    features: temples.map(temple => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [temple.lon, temple.lat] },
      properties: { qid: temple.qid, name: temple.name, color: deityColors[temple.deity] || '#c67449' },
    })),
  };
}

function showWorld(map: maplibregl.Map, mode: MapMode, duration = 700) {
  if (mode === 'globe') {
    map.flyTo({ center: [35, 15], zoom: map.getContainer().clientWidth > 900 ? 2 : 1.1, duration });
  } else {
    // Fit the complete inhabited world to the actual canvas, including narrow screens.
    map.fitBounds([[-179, -58], [179, 78]], { padding: 16, duration, bearing: 0, pitch: 0 });
  }
}

export default function GlobeMap({ temples, onSelect, selected, country, mode, zoomCommand }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const data = useRef(temples);
  const select = useRef(onSelect);
  const modeRef = useRef(mode);
  const selectedMarkerRef = useRef<maplibregl.Marker | null>(null);
  const previousCamera = useRef<{ mode: MapMode; country: string; selectedId?: string } | null>(null);
  const cameraRef = useRef({ country, selected });
  useEffect(() => { cameraRef.current = { country, selected }; }, [country, selected]);
  const [loadedMap, setLoadedMap] = useState<maplibregl.Map | null>(null);

  useEffect(() => { data.current = temples; select.current = onSelect; modeRef.current = mode; }, [temples, onSelect, mode]);

  useEffect(() => {
    if (!container.current) return;
    maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
    const m = new maplibregl.Map({
      container: container.current,
      center: [0, 15], zoom: 0, minZoom: -2, maxZoom: 14,
      renderWorldCopies: false, attributionControl: false,
      cooperativeGestures: window.matchMedia('(pointer: coarse)').matches,
      style: {
        version: 8, projection: { type: 'mercator' },
        sky: { 'sky-color': '#fff7f0', 'horizon-color': '#fff7f0', 'fog-color': '#fff7f0', 'sky-horizon-blend': 0, 'horizon-fog-blend': 0, 'fog-ground-blend': 0 },
        glyphs: basemap.glyphs, sprite: basemap.sprite,
        sources: { ...basemap.sources as maplibregl.StyleSpecification['sources'], countries: { type: 'geojson', data: '/countries.geojson' } },
        layers: [
          { id: 'ocean', type: 'background', paint: { 'background-color': '#f8dfbf' } },
          { id: 'land', type: 'fill', source: 'countries', paint: { 'fill-color': '#e49350', 'fill-opacity': 0.95 } },
          { id: 'borders', type: 'line', source: 'countries', paint: { 'line-color': '#ffe6cc', 'line-width': 0.7 } },
          ...basemap.layers as maplibregl.LayerSpecification[],
        ],
      },
    });
    map.current = m;
    const selectedMarker = new maplibregl.Marker({ color: '#fb651e', scale: 0.9 });
    selectedMarkerRef.current = selectedMarker;
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
    // Draw cluster counts using local system fonts; no remote glyph service required.
    m.setMissingStyleImageResolver(id => {
      if (!id.startsWith('cluster-label-') || m.hasImage(id)) return;
      const canvas = document.createElement('canvas'); canvas.width = 112; canvas.height = 56;
      const context = canvas.getContext('2d'); if (!context) return;
      context.font = 'bold 25px Arial'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = '#ffffff';
      context.fillText(id.slice('cluster-label-'.length), 56, 28);
      m.addImage(id, context.getImageData(0, 0, 112, 56), { pixelRatio: 2 });
    });
    m.on('load', () => {
      m.addSource('temples', { type: 'geojson', data: templeFeatures(data.current), cluster: true, clusterRadius: 36, clusterMaxZoom: 11 });
      m.addLayer({ id: 'clusters', type: 'circle', source: 'temples', filter: ['has', 'point_count'], paint: {
        'circle-color': ['step', ['get', 'point_count'], '#ec8b4f', 100, '#fb651e', 1000, '#d94e12'],
        'circle-radius': ['step', ['get', 'point_count'], 17, 100, 21, 1000, 25],
        'circle-stroke-color': '#fff9ee', 'circle-stroke-width': 2,
      } });
      m.addLayer({ id: 'cluster-counts', type: 'symbol', source: 'temples', filter: ['has', 'point_count'], layout: {
        'icon-image': ['concat', 'cluster-label-', ['to-string', ['get', 'point_count_abbreviated']]],
        'icon-allow-overlap': true,
      } });
      m.addLayer({ id: 'points-halo', type: 'circle', source: 'temples', filter: ['!', ['has', 'point_count']], paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 6, 4, 9, 8, 13],
        'circle-color': ['get', 'color'], 'circle-opacity': 0.2,
      } });
      m.addLayer({ id: 'points', type: 'circle', source: 'temples', filter: ['!', ['has', 'point_count']], paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 3.5, 4, 5, 8, 7],
        'circle-color': ['get', 'color'], 'circle-stroke-color': '#fff9ee', 'circle-stroke-width': 1,
      } });
      setLoadedMap(m);
    });
    m.on('click', 'clusters', async event => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== 'Point') return;
      const source = m.getSource('temples') as GeoJSONSource;
      try {
        const level = await source.getClusterExpansionZoom(Number(feature.properties.cluster_id));
        popup.remove(); m.easeTo({ center: feature.geometry.coordinates as [number, number], zoom: level + 0.2 });
      } catch { /* The source may change when a filter is applied. */ }
    });
    m.on('mousemove', 'clusters', event => {
      m.getCanvas().style.cursor = 'pointer';
      const feature = event.features?.[0];
      if (feature?.geometry.type === 'Point') popup.setLngLat(feature.geometry.coordinates as [number, number]).setText(`${Number(feature.properties.point_count).toLocaleString()} mapped places · select to zoom in`).addTo(m);
    });
    m.on('mouseleave', 'clusters', () => { m.getCanvas().style.cursor = 'grab'; popup.remove(); });
    m.on('click', 'points', event => {
      const temple = data.current.find(t => t.qid === event.features?.[0]?.properties.qid);
      if (temple) { popup.remove(); select.current(temple); }
    });
    m.on('mousemove', 'points', event => {
      m.getCanvas().style.cursor = 'pointer';
      const temple = data.current.find(t => t.qid === event.features?.[0]?.properties.qid);
      if (temple) popup.setLngLat([temple.lon, temple.lat]).setText(temple.name).addTo(m);
    });
    m.on('mouseleave', 'points', () => { m.getCanvas().style.cursor = 'grab'; popup.remove(); });
    const resize = new ResizeObserver(() => {
      m.resize();
      if (!m.getSource('temples')) return;
      const camera = cameraRef.current;
      if (!camera.selected && camera.country === 'All countries') showWorld(m, modeRef.current, 0);
      else if (!camera.selected && data.current.length) {
        const bounds = new maplibregl.LngLatBounds();
        data.current.forEach(temple => bounds.extend([temple.lon, temple.lat]));
        m.fitBounds(bounds, { padding: 40, maxZoom: 5, duration: 0 });
      }
    });
    resize.observe(container.current);
    return () => { resize.disconnect(); selectedMarker.remove(); previousCamera.current = null; popup.remove(); m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    if (!loadedMap || loadedMap !== map.current) return;
    (map.current?.getSource('temples') as GeoJSONSource | undefined)?.setData(templeFeatures(temples));
  }, [temples, loadedMap]);

  useEffect(() => {
    const m = map.current;
    if (!m || m !== loadedMap) return;
    const previous = previousCamera.current;
    const viewChanged = !previous || previous.mode !== mode || previous.country !== country;
    m.setProjection({ type: mode === 'world' ? 'mercator' : 'globe' });
    if (selected) {
      selectedMarkerRef.current?.setLngLat([selected.lon, selected.lat]).addTo(m);
      if (viewChanged || previous?.selectedId !== selected.qid) {
        const mobile = window.matchMedia('(max-width: 900px)').matches;
        m.flyTo({ center: [selected.lon, selected.lat], zoom: Math.max(5, Math.min(m.getZoom(), 12)),
          offset: mobile ? [0, -m.getContainer().clientHeight * 0.18] : [-110, 0], duration: 1100 });
      }
    } else {
      selectedMarkerRef.current?.remove();
      // Closing details preserves the place the visitor was exploring.
      if (viewChanged || !previous?.selectedId) {
        if (country !== 'All countries' && temples.length) {
          const bounds = new maplibregl.LngLatBounds();
          temples.forEach(temple => bounds.extend([temple.lon, temple.lat]));
          m.fitBounds(bounds, { padding: 40, maxZoom: 5, duration: 900 });
        } else showWorld(m, mode);
      }
    }
    previousCamera.current = { mode, country, selectedId: selected?.qid };
  }, [mode, country, selected, loadedMap, temples]);

  useEffect(() => {
    const m = map.current;
    if (!m || m !== loadedMap || !zoomCommand.value) return;
    if (zoomCommand.kind === 'reset') showWorld(m, modeRef.current);
    else if (zoomCommand.kind === 'in') m.zoomIn();
    else if (zoomCommand.kind === 'out') m.zoomOut();
    else m.easeTo({ center: [m.getCenter().lng + (zoomCommand.kind === 'west' ? -60 : 60), m.getCenter().lat], duration: 650 });
  }, [zoomCommand, loadedMap]);

  return <div ref={container} className="globe-canvas" aria-label={mode === 'world' ? 'World map of Hindu temples' : 'Interactive globe of Hindu temples'} />;
}
