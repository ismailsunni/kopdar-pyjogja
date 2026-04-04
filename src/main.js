
import 'nouislider/dist/nouislider.css';
import './style.css';

import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Cluster from 'ol/source/Cluster';
import GeoJSON from 'ol/format/GeoJSON';
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style';
import Overlay from 'ol/Overlay';
import { fromLonLat, toLonLat, transformExtent } from 'ol/proj';
import { boundingExtent, containsCoordinate } from 'ol/extent';
import noUiSlider from 'nouislider';

import kopdarData from './data/kopdar.geojson?raw';

// ── Color palette ──────────────────────────────────────────
const TYPE_COLORS = {
  normal_talk: '#3b82f6',
  lightning_talk: '#f59e0b',
  conference: '#8b5cf6',
  workshop: '#10b981',
  hackathon: '#ef4444',
};

const TYPE_LABELS = {
  normal_talk: 'Talks',
  lightning_talk: 'Lightning Talk',
  online: 'Online',
  social: 'Syawalan',
  conference: 'Konferensi',
  workshop: 'Workshop',
  hackathon: 'Hackathon',
};

function getColor(type) {
  return TYPE_COLORS[type] || '#6b7280';
}

// ── Cluster style ──────────────────────────────────────────
let selectedFeature = null;
let hoveredFeature = null;

function clusterStyle(clusterFeature) {
  const features = clusterFeature.get('features');
  if (!features || features.length === 0) return null;
  const size = features.length;

  if (size === 1) {
    const f = features[0];
    const type = f.get('type');
    const color = getColor(type);
    let radius = 8;
    let strokeWidth = 2;
    let strokeColor = '#fff';
    if (f === selectedFeature) {
      radius = 12;
      strokeWidth = 4;
      strokeColor = '#d97706';
    } else if (f === hoveredFeature) {
      radius = 10;
      strokeWidth = 3;
    }
    return new Style({
      image: new CircleStyle({
        radius,
        fill: new Fill({ color }),
        stroke: new Stroke({ color: strokeColor, width: strokeWidth }),
      }),
    });
  }

  // Cluster — blue circle with count
  return new Style({
    image: new CircleStyle({
      radius: 14 + Math.min(size, 10),
      fill: new Fill({ color: 'rgba(59,130,246,0.85)' }),
      stroke: new Stroke({ color: '#fff', width: 2.5 }),
    }),
    text: new Text({
      text: String(size),
      fill: new Fill({ color: '#fff' }),
      font: 'bold 13px sans-serif',
    }),
  });
}

// ── GeoJSON source ─────────────────────────────────────────
const allFeatures = new GeoJSON().readFeatures(JSON.parse(kopdarData), {
  featureProjection: 'EPSG:3857',
});

const vectorSource = new VectorSource({ features: allFeatures.slice() });

const clusterSource = new Cluster({
  distance: 40,
  source: vectorSource,
});

let clusterLayer = new VectorLayer({
  source: clusterSource,
  style: clusterStyle,
  zIndex: 10,
});

// ── Basemaps ───────────────────────────────────────────────
const BASEMAPS = {
  positron: new TileLayer({ source: new XYZ({ url: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', attributions: '© CARTO © OSM', crossOrigin: 'anonymous' }) }),
  osm:      new TileLayer({ source: new XYZ({ url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attributions: '© OSM contributors', crossOrigin: 'anonymous' }) }),
  topo:     new TileLayer({ source: new XYZ({ url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png', attributions: '© OpenTopoMap © OSM', crossOrigin: 'anonymous' }) }),
};
BASEMAPS.osm.setVisible(false);
BASEMAPS.topo.setVisible(false);

// ── Map ────────────────────────────────────────────────────
const JOGJA_EXTENT = transformExtent([110.28, -7.95, 110.48, -7.65], 'EPSG:4326', 'EPSG:3857');

const map = new Map({
  target: 'map',
  layers: [
    BASEMAPS.positron,
    BASEMAPS.osm,
    BASEMAPS.topo,
    clusterLayer,
  ],
  view: new View({
    center: fromLonLat([110.38, -7.80]),
    zoom: 12,
  }),
});

map.getView().fit(JOGJA_EXTENT, { padding: [20, 20, 20, 20] });

// ── Popup overlay ──────────────────────────────────────────
const popupEl = document.getElementById('popup');
const popupContent = document.getElementById('popup-content');
const popupCloser = document.getElementById('popup-closer');

const popup = new Overlay({
  element: popupEl,
  positioning: 'bottom-center',
  stopEvent: true,
  offset: [0, -14],
});
map.addOverlay(popup);

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function showPopup(feature) {
  const p = feature.getProperties();
  const color = getColor(p.type);
  const links = [];
  if (p.announcement_url) links.push(`<a class="popup-link" href="${p.announcement_url}" target="_blank" rel="noopener">📢 Pengumuman</a>`);
  if (p.docs_url) links.push(`<a class="popup-link" href="${p.docs_url}" target="_blank" rel="noopener">📄 Docs</a>`);
  if (p.photo_url) links.push(`<a class="popup-link" href="${p.photo_url}" target="_blank" rel="noopener">📷 Foto</a>`);

  popupContent.innerHTML = `
    <div class="popup-header">
      <span class="popup-dot" style="background:${color}"></span>
      <span class="popup-name">${p.name}</span>
    </div>
    <div class="popup-row">📅 ${formatDate(p.date)}</div>
    <div class="popup-row">🏢 ${p.host}</div>
    <div class="popup-row">🏷️ ${TYPE_LABELS[p.type] || p.type}</div>
    ${p.description ? `<div class="popup-desc">📝 ${p.description}</div>` : ''}
    ${links.length ? `<div class="popup-links">${links.join('')}</div>` : ''}
  `;

  // Use the actual point coordinate (from the inner feature geometry)
  const coord = feature.getGeometry().getCoordinates();
  popup.setPosition(coord);
  popupEl.classList.add('visible');
}

function hidePopup() {
  popupEl.classList.remove('visible');
  popup.setPosition(undefined);
  if (selectedFeature) {
    selectedFeature = null;
    clusterLayer.changed();
  }
}

popupCloser.addEventListener('click', hidePopup);

// ── List popup overlay ─────────────────────────────────────
const listPopupEl = document.getElementById('list-popup');
const listPopupContent = document.getElementById('list-popup-content');
const listPopupCloser = document.getElementById('list-popup-closer');

const listOverlay = new Overlay({
  element: listPopupEl,
  positioning: 'bottom-center',
  stopEvent: true,
  offset: [0, -14],
});
map.addOverlay(listOverlay);

function showListPopup(features, coord) {
  const sorted = features.slice().sort((a, b) => new Date(a.get('date')) - new Date(b.get('date')));

  const items = sorted.map((f) => {
    const p = f.getProperties();
    const color = getColor(p.type);
    return `<div class="list-popup-item" data-no="${p.no}">
      <span class="popup-dot" style="background:${color}"></span>
      <span class="list-item-no">#${p.no}</span>
      <span class="list-item-name">${p.name}</span>
      <span class="list-item-date">${formatDate(p.date)}</span>
      <span class="list-item-type">${TYPE_LABELS[p.type] || p.type}</span>
    </div>`;
  }).join('');

  listPopupContent.innerHTML = `
    <div class="list-popup-header">${features.length} Kopdar di lokasi ini</div>
    <div class="list-popup-scroll">${items}</div>
  `;

  listPopupContent.querySelectorAll('.list-popup-item').forEach((item) => {
    item.addEventListener('click', () => {
      const no = Number(item.dataset.no);
      const f = features.find((feat) => feat.get('no') === no);
      if (f) {
        hideListPopup();
        selectedFeature = f;
        clusterLayer.changed();
        showPopup(f);
      }
    });
  });

  listOverlay.setPosition(coord);
  listPopupEl.classList.add('visible');
}

function hideListPopup() {
  listPopupEl.classList.remove('visible');
  listOverlay.setPosition(undefined);
}

listPopupCloser.addEventListener('click', hideListPopup);

// ── Click handler ──────────────────────────────────────────
map.on('click', (evt) => {
  const clusterFeature = map.forEachFeatureAtPixel(evt.pixel, (f) => f, { layerFilter: (l) => l === clusterLayer });
  if (clusterFeature) {
    const features = clusterFeature.get('features');
    if (features.length > 1) {
      const coords = features.map((f) => f.getGeometry().getCoordinates());
      const [refLon, refLat] = toLonLat(coords[0]);
      const allSame = coords.every((c) => {
        const [lon, lat] = toLonLat(c);
        return Math.abs(lon - refLon) < 0.0001 && Math.abs(lat - refLat) < 0.0001;
      });

      if (allSame) {
        hidePopup();
        showListPopup(features, coords[0]);
      } else {
        hideListPopup();
        const ext = boundingExtent(coords);
        map.getView().fit(ext, { padding: [80, 80, 80, 80], duration: 400, maxZoom: 16 });
      }
      return;
    }
    hideListPopup();
    const feature = features[0];
    selectedFeature = feature;
    clusterLayer.changed();
    showPopup(feature);
  } else {
    hidePopup();
    hideListPopup();
  }
});

// ── Hover / tooltip ────────────────────────────────────────
const tooltipEl = document.getElementById('tooltip');

map.on('pointermove', (evt) => {
  if (evt.dragging) return;

  const clusterFeature = map.forEachFeatureAtPixel(evt.pixel, (f) => f, { layerFilter: (l) => l === clusterLayer });

  let feature = null;
  if (clusterFeature) {
    const features = clusterFeature.get('features');
    if (features && features.length === 1) {
      feature = features[0];
    }
  }

  const prevHovered = hoveredFeature;
  hoveredFeature = feature;

  if (hoveredFeature !== prevHovered) {
    clusterLayer.changed();
  }

  if (clusterFeature) {
    map.getTargetElement().style.cursor = 'pointer';
    if (feature) {
      const p = feature.getProperties();
      tooltipEl.textContent = `${p.name} · ${p.date}`;
    } else {
      const cnt = clusterFeature.get('features').length;
      tooltipEl.textContent = `${cnt} kopdar`;
    }
    tooltipEl.style.display = 'block';
    tooltipEl.style.left = evt.pixel[0] + 'px';
    tooltipEl.style.top = evt.pixel[1] + 'px';
  } else {
    map.getTargetElement().style.cursor = '';
    tooltipEl.style.display = 'none';
  }
});

// ── Filters ────────────────────────────────────────────────
const dates = allFeatures.map((f) => new Date(f.get('date') + 'T00:00:00').getTime());
const minDate = Math.min(...dates);
const maxDate = Math.max(...dates);

const activeTypes = new Set(Object.keys(TYPE_COLORS));

// Declare early — used by formatDateShort inside updateList, which fires
// synchronously during noUiSlider.create() below (TDZ fix)
const MONTHS_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

const sliderEl = document.getElementById('time-slider');
const rangeLabel = document.getElementById('time-range-label');

noUiSlider.create(sliderEl, {
  start: [minDate, maxDate],
  connect: true,
  range: { min: minDate, max: maxDate },
  step: 24 * 60 * 60 * 1000,
});

function formatMonthYear(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
}

function applyFilters(sliderValues) {
  const values = sliderValues !== undefined ? sliderValues : sliderEl.noUiSlider.get();
  const [from, to] = values.map(Number);
  rangeLabel.textContent = `${formatMonthYear(from)} — ${formatMonthYear(to)}`;

  const filtered = allFeatures.filter((feature) => {
    const ts = new Date(feature.get('date') + 'T00:00:00').getTime();
    const type = feature.get('type');
    return ts >= from && ts <= to && activeTypes.has(type);
  });

  vectorSource.clear();
  vectorSource.addFeatures(filtered);

  document.getElementById('stats-bar').textContent = `${filtered.length} kopdar ditampilkan`;

  if (selectedFeature && !filtered.includes(selectedFeature)) {
    hidePopup();
  }

  updateList();
}

sliderEl.noUiSlider.on('update', (values) => applyFilters(values));

document.getElementById('reset-filter').addEventListener('click', () => {
  sliderEl.noUiSlider.set([minDate, maxDate]);
});

// ── Type filter pills ──────────────────────────────────────
document.querySelectorAll('.type-pill').forEach((pill) => {
  pill.addEventListener('click', () => {
    const type = pill.dataset.type;
    if (activeTypes.has(type)) {
      activeTypes.delete(type);
      pill.classList.remove('active');
    } else {
      activeTypes.add(type);
      pill.classList.add('active');
    }
    applyFilters();
  });
});

// ── Basemap switcher ───────────────────────────────────────
document.querySelectorAll('#basemap-switcher button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.basemap;
    Object.entries(BASEMAPS).forEach(([k, layer]) => layer.setVisible(k === key));
    document.querySelectorAll('#basemap-switcher button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ── Minimize panel ─────────────────────────────────────────
document.getElementById('minimize-btn').addEventListener('click', () => {
  const panel = document.getElementById('panel');
  const btn = document.getElementById('minimize-btn');
  panel.classList.toggle('minimized');
  btn.textContent = panel.classList.contains('minimized') ? '+' : '–';
});

// ── Reset extent button ────────────────────────────────────
document.getElementById('extent-btn').addEventListener('click', () => {
  map.getView().fit(JOGJA_EXTENT, { duration: 600, padding: [20, 20, 20, 20] });
});

// ── Kopdar list ────────────────────────────────────────────
function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

function updateList() {
  const mapExtent = map.getView().calculateExtent(map.getSize());
  const values = sliderEl.noUiSlider.get();
  const [from, to] = values.map(Number);

  const visible = allFeatures.filter((f) => {
    const ts = new Date(f.get('date') + 'T00:00:00').getTime();
    const type = f.get('type');
    if (!(ts >= from && ts <= to && activeTypes.has(type))) return false;
    const coord = f.getGeometry().getCoordinates();
    return containsCoordinate(mapExtent, coord);
  });

  visible.sort((a, b) => new Date(a.get('date') + 'T00:00:00') - new Date(b.get('date') + 'T00:00:00'));

  const listEl = document.getElementById('kopdar-list');
  const countEl = document.getElementById('list-count');
  countEl.textContent = visible.length;

  if (visible.length === 0) {
    listEl.innerHTML = '<div style="font-size:0.72rem;color:#9ca3af;padding:0.5rem 0.4rem;">Tidak ada kopdar di area ini</div>';
    return;
  }

  listEl.innerHTML = visible.map((f) => {
    const p = f.getProperties();
    const color = getColor(p.type);
    const typeLabel = TYPE_LABELS[p.type] || p.type;
    return `<div class="kopdar-item" data-no="${p.no}">
      <div class="kopdar-item-no">#${p.no}</div>
      <div class="kopdar-item-info">
        <div class="kopdar-item-name">${p.name}</div>
        <div class="kopdar-item-meta">${formatDateShort(p.date)} · ${typeLabel}</div>
      </div>
      <div class="kopdar-item-dot" style="background:${color}"></div>
    </div>`;
  }).join('');

  listEl.querySelectorAll('.kopdar-item').forEach((item) => {
    item.addEventListener('click', () => {
      const no = Number(item.dataset.no);
      const f = allFeatures.find((feat) => feat.get('no') === no);
      if (f) {
        map.getView().animate({ center: f.getGeometry().getCoordinates(), zoom: Math.max(map.getView().getZoom(), 15), duration: 400 });
        selectedFeature = f;
        clusterLayer.changed();
        showPopup(f);
        listEl.querySelectorAll('.kopdar-item').forEach((i) => i.classList.remove('active'));
        item.classList.add('active');
      }
    });
  });
}

map.on('moveend', updateList);
