import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { clusterPlaces } from '@/lib/cluster';
import type { Place } from '@/lib/types';
import { brand, kindStyle } from '@/theme/tokens';

type Props = { places: Place[]; center: { lat: number; lng: number }; selected?: number; onSelect: (p: Place) => void; onLongPress?: (c: { lat: number; lng: number }) => void; lite?: boolean; zoom?: number };

/* eslint-disable @typescript-eslint/no-explicit-any */
let leaflet: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if (leaflet) return leaflet;
  leaflet = new Promise((res, rej) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    s.onload = () => res((window as any).L); s.onerror = rej;
    document.head.appendChild(s);
  });
  return leaflet;
}

// أيقونات الأنواع كرموز بسيطة (الخريطة على الويب ما تقدر ترسم أيقونات SVG حقت التطبيق)
const GLYPH: Record<string, string> = { food: '🍴', cafe: '☕', sights: '★', heritage: '⌂', nature: '▲', islamic: '☪', fun: '☺', shopping: '◆' };

/** خريطة حقيقية لنسخة الويب (Leaflet + خرائط CARTO) بنفس دبابيس التطبيق وتجميعها */
export const MapCanvas = forwardRef<unknown, Props>(function MapCanvas({ places, center, selected, onSelect, onLongPress, lite, zoom }, ref) {
  const box = useRef<View>(null);
  const map = useRef<any>(null);
  const layer = useRef<any>(null);
  const cb = useRef({ onSelect, onLongPress, places, selected });
  cb.current = { onSelect, onLongPress, places, selected };

  useImperativeHandle(ref, () => ({
    animateToRegion: (r: { latitude: number; longitude: number }) => map.current?.flyTo([r.latitude, r.longitude], Math.max(map.current.getZoom(), 15)),
    animateCamera: (c: { center: { latitude: number; longitude: number } }) => map.current?.flyTo([c.center.latitude, c.center.longitude], Math.max(map.current.getZoom(), 15)),
  }));

  const draw = () => {
    const L = (window as any).L, m = map.current;
    if (!L || !m) return;
    if (layer.current) layer.current.remove();
    layer.current = L.layerGroup().addTo(m);
    const b = m.getBounds();
    const clusters = clusterPlaces(cb.current.places, { latitudeDelta: b.getNorth() - b.getSouth(), longitudeDelta: b.getEast() - b.getWest() }, cb.current.selected);
    for (const c of clusters) {
      if (c.items.length > 1) {
        const n = c.items.length, sz = n < 10 ? 40 : n < 50 ? 48 : 56;
        const icon = L.divIcon({ className: '', iconSize: [sz, sz], html: `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${brand.purple};border:4px solid rgba(255,255,255,.85);color:#fff;font:700 15px 'IBM Plex Sans Arabic',sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.25)">${n}</div>` });
        L.marker([c.lat, c.lng], { icon }).addTo(layer.current).on('click', () => {
          const lb = L.latLngBounds(c.items.map((p) => [p.lat, p.lng]));
          m.flyToBounds(lb.pad(0.3), { maxZoom: 17 });
        });
      } else {
        const p = c.items[0];
        const ks = kindStyle[p.kinds[0]] ?? kindStyle.sights;
        const on = p.id === cb.current.selected, sz = on ? 46 : 32;
        const icon = L.divIcon({ className: '', iconSize: [sz, sz], html: `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${on ? brand.orange : ks.fg};border:3px solid #fff;color:#fff;font-size:${on ? 20 : 14}px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.25)">${GLYPH[p.kinds[0]] ?? '•'}</div>` });
        L.marker([p.lat!, p.lng!], { icon, zIndexOffset: on ? 1000 : 0 }).addTo(layer.current).on('click', () => cb.current.onSelect(p));
      }
    }
  };

  useEffect(() => {
    let dead = false;
    loadLeaflet().then((L) => {
      if (dead || !box.current) return;
      const m = L.map(box.current as unknown as HTMLElement, { zoomControl: false, attributionControl: !lite, dragging: !lite, scrollWheelZoom: !lite, doubleClickZoom: !lite, touchZoom: !lite, keyboard: !lite }).setView([center.lat, center.lng], zoom ? 15 : 13);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '© OpenStreetMap © CARTO' }).addTo(m);
      m.on('moveend', draw);
      m.on('contextmenu', (e: any) => cb.current.onLongPress?.({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) }));
      map.current = m;
      draw();
    }).catch(() => {});
    return () => { dead = true; map.current?.remove(); map.current = null; };
  }, [center.lat, center.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { draw(); }, [places, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  return <View ref={box} style={[StyleSheet.absoluteFill, { backgroundColor: '#EEF0EA' }]} />;
});
