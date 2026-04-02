import 'ol/ol.css';
import 'nouislider/dist/nouislider.css';
import './style.css';

import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
import Overlay from 'ol/Overlay';
import { fromLonLat, transformExtent } from 'ol/proj';
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
  normal_talk: 'Talks Biasa',
  lightning_talk: 'Lightning Talk',
  conference: 'Konferensi',
  workshop: 'Workshop',
  hackathon: 'Hackathon',
};

function getColor(type) {
  return TYPE_COLORS[type] || '#6b7280';
}

// ── Style functions ────────────────────────────────────────
function makeStyle(type, radius, strokeWidth, strokeColor = 'white') {
  return new Style({
    image: new CircleStyle({
      radius,
      fill: new Fill({ color: getColor(type) }),
      stroke: new Stroke({ color: strokeColor, width: strokeWidth }),
    }),
  });
}

let selectedFeature = null;
let hoveredFeature = null;

function styleFunction(feature) {
  const type = feature.get('type');
  if (feature === selectedFeature) {
    return makeStyle(type, 12, 4, '#d97706');
  }
  if (feature === hoveredFeature) {
    return makeStyle(type, 10, 3);
  }
  return makeStyle(type, 8, 2);
}

// ── GeoJSON source ─────────────────────────────────────────
const vectorSource = new VectorSource({
  features: new GeoJSON().readFeatures(JSON.parse(kopdarData), {
    featureProjection: 'EPSG:3857',
  }),
});

const vectorLayer = new VectorLayer({
  source: vectorSource,
  style: styleFunction,
  zIndex: 10,
});

// ── Map ────────────────────────────────────────────────────
const extent = transformExtent([110.28, -7.95, 110.48, -7.65], 'EPSG:4326', 'EPSG:3857');

const map = new Map({
  target: 'map',
  layers: [
    new TileLayer({ source: new OSM() }),
    vectorLayer,
  ],
  view: new View({
    center: fromLonLat([110.38, -7.80]),
    zoom: 12,
    extent,
    constrainOnlyCenter: false,
  }),
});

// Fit to Jogja extent on load
map.getView().fit(extent, { padding: [20, 20, 20, 20] });

// ── Popup overlay ──────────────────────────────────────────
const popupEl = document.getElementById('popup');
const popupContent = document.getElementById('popup-content');
const popupCloser = document.getElementById('popup-closer');

const popup = new Overlay({
  element: popupEl,
  positioning: 'bottom-center',
  stopEvent: true,
  offset: [0, -16],
});
map.addOverlay(popup);

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function showPopup(feature, coordinate) {
  const p = feature.getProperties();
  const links = [];
  if (p.announcement_url) links.push(`<a class="popup-link" href="${p.announcement_url}" target="_blank" rel="noopener">📢 Pengumuman</a>`);
  if (p.docs_url) links.push(`<a class="popup-link" href="${p.docs_url}" target="_blank" rel="noopener">📄 Dokumentasi</a>`);
  if (p.photo_url) links.push(`<a class="popup-link" href="${p.photo_url}" target="_blank" rel="noopener">📷 Foto</a>`);

  popupContent.innerHTML = `
    <div class="popup-title">${p.name}</div>
    <div class="popup-row">📅 ${formatDate(p.date)}</div>
    <div class="popup-row">🏢 ${p.host}</div>
    <div class="popup-row">🏷️ ${TYPE_LABELS[p.type] || p.type}</div>
    ${p.description ? `<div class="popup-desc">📝 ${p.description}</div>` : ''}
    ${links.length ? `<div class="popup-links">${links.join('')}</div>` : ''}
  `;

  popup.setPosition(coordinate);
  popupEl.style.display = 'block';
}

function hidePopup() {
  popupEl.style.display = 'none';
  popup.setPosition(undefined);
  if (selectedFeature) {
    selectedFeature = null;
    vectorLayer.changed();
  }
}

popupCloser.addEventListener('click', hidePopup);

// ── Click handler ──────────────────────────────────────────
map.on('click', (evt) => {
  const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f, { layerFilter: (l) => l === vectorLayer });
  if (feature) {
    selectedFeature = feature;
    vectorLayer.changed();
    showPopup(feature, evt.coordinate);
  } else {
    hidePopup();
  }
});

// ── Hover / tooltip ────────────────────────────────────────
const tooltipEl = document.getElementById('tooltip');

map.on('pointermove', (evt) => {
  if (evt.dragging) return;

  const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f, { layerFilter: (l) => l === vectorLayer });

  const prevHovered = hoveredFeature;
  hoveredFeature = feature || null;

  if (hoveredFeature !== prevHovered) {
    vectorLayer.changed();
  }

  if (feature) {
    map.getTargetElement().style.cursor = 'pointer';
    const p = feature.getProperties();
    tooltipEl.textContent = `${p.name} · ${p.date}`;
    tooltipEl.style.display = 'block';
    tooltipEl.style.left = evt.pixel[0] + 'px';
    tooltipEl.style.top = evt.pixel[1] + 'px';
  } else {
    map.getTargetElement().style.cursor = '';
    tooltipEl.style.display = 'none';
  }
});

// ── Time range slider ──────────────────────────────────────
const features = vectorSource.getFeatures();
const dates = features.map((f) => new Date(f.get('date') + 'T00:00:00').getTime());
const minDate = Math.min(...dates);
const maxDate = Math.max(...dates);

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

function updateFilter(values) {
  const [from, to] = values.map(Number);
  rangeLabel.textContent = `${formatMonthYear(from)} — ${formatMonthYear(to)}`;

  features.forEach((feature) => {
    const ts = new Date(feature.get('date') + 'T00:00:00').getTime();
    feature.set('_hidden', ts < from || ts > to);
  });
  vectorSource.changed();

  // Hide popup if selected feature is now filtered out
  if (selectedFeature && selectedFeature.get('_hidden')) {
    hidePopup();
  }
}

sliderEl.noUiSlider.on('update', (values) => updateFilter(values));

// Override style to hide filtered features
vectorLayer.setStyle((feature) => {
  if (feature.get('_hidden')) return null;
  return styleFunction(feature);
});

document.getElementById('reset-filter').addEventListener('click', () => {
  sliderEl.noUiSlider.set([minDate, maxDate]);
});
