// ── SERVICE WORKER ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

// ── STORAGE ──
const TRIPS_KEY = 'filey_trips';

function loadTrips() {
  try { return JSON.parse(localStorage.getItem(TRIPS_KEY)) || []; }
  catch { return []; }
}

function saveTrips(trips) {
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── STATE ──
let trips = loadTrips();
let editingId = null;
let companions = [];
let photos = []; // { dataUrl, name }
let salahMarker = null;
let calYear, calMonth;

// ── NAV ──
const navBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    navBtns.forEach(b => b.classList.remove('active'));
    views.forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-' + btn.dataset.view).classList.add('active');
    if (btn.dataset.view === 'diary') renderDiary();
    if (btn.dataset.view === 'calendar') renderCalendar();
    if (btn.dataset.view === 'map') setTimeout(() => map.invalidateSize(), 50);
  });
});

// ── MAP ──
const FILEY = [54.2093, -0.2863];

const map = L.map('map', {
  center: FILEY,
  zoom: 14,
  zoomControl: false,
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap',
  maxZoom: 19,
}).addTo(map);

L.control.zoom({ position: 'bottomright' }).addTo(map);

// Filey marker
L.marker(FILEY, {
  icon: L.divIcon({
    className: '',
    html: '<div style="font-size:2rem;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">🌊</div>',
    iconAnchor: [16, 16],
  })
}).addTo(map).bindPopup('<b>Filey</b><br>Welcome back! 🐚');

// Trip markers
function renderMapMarkers() {
  map.eachLayer(layer => {
    if (layer._fileyTrip) map.removeLayer(layer);
  });
  trips.forEach(trip => {
    if (!trip.lat || !trip.lng) return;
    const m = L.marker([trip.lat, trip.lng], {
      icon: L.divIcon({
        className: '',
        html: '<div style="font-size:1.6rem">📍</div>',
        iconAnchor: [12, 24],
      })
    }).addTo(map);
    m._fileyTrip = true;
    m.bindPopup(`<b>${trip.name}</b><br>${formatDateRange(trip.start, trip.end)}`);
  });
}

// Salah cat toggle
document.getElementById('toggle-salah').addEventListener('change', function () {
  if (this.checked) {
    salahMarker = L.marker([54.2110, -0.2840], {
      icon: L.divIcon({
        className: '',
        html: '<div style="font-size:2.2rem;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5))">🐱</div>',
        iconAnchor: [18, 18],
      })
    }).addTo(map);
    salahMarker.bindPopup('<b>Salah</b><br>Meow! 🐾').openPopup();
  } else {
    if (salahMarker) { map.removeLayer(salahMarker); salahMarker = null; }
  }
});

// ── DIARY ──
function formatDateRange(start, end) {
  if (!start) return '';
  const s = new Date(start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  if (!end || end === start) return s;
  const e = new Date(end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${s} – ${e}`;
}

function renderDiary() {
  const list = document.getElementById('trips-list');
  if (trips.length === 0) {
    list.innerHTML = `<div class="empty-state"><span class="big">🏖️</span>No trips yet!<br>Add your first Filey adventure.</div>`;
    return;
  }
  const sorted = [...trips].sort((a, b) => (b.start || '').localeCompare(a.start || ''));
  list.innerHTML = sorted.map(trip => {
    const bannerImg = trip.photos && trip.photos[0]
      ? `<img src="${trip.photos[0]}" alt="" />`
      : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:3rem">🌊</div>`;
    const chips = (trip.companions || []).map(c =>
      `<span class="companion-chip">👤 ${c}</span>`
    ).join('');
    return `
      <div class="trip-card" onclick="openEditTrip('${trip.id}')">
        <div class="trip-card-banner">${bannerImg}</div>
        <div class="trip-card-body">
          <div class="trip-card-title">${trip.name || 'Untitled Trip'}</div>
          <div class="trip-card-dates">${formatDateRange(trip.start, trip.end)}</div>
          <div class="trip-card-companions">${chips}</div>
        </div>
      </div>`;
  }).join('');
  renderMapMarkers();
}

document.getElementById('new-trip-btn').addEventListener('click', () => openNewTrip());

// ── MODAL ──
function openNewTrip() {
  editingId = null;
  companions = [];
  photos = [];
  document.getElementById('modal-title').textContent = 'New Trip';
  document.getElementById('trip-name').value = '';
  document.getElementById('trip-start').value = '';
  document.getElementById('trip-end').value = '';
  document.getElementById('trip-notes').value = '';
  document.getElementById('delete-trip').classList.add('hidden');
  renderCompanionTags();
  renderPhotoPreviews();
  document.getElementById('trip-modal').classList.remove('hidden');
}

function openEditTrip(id) {
  const trip = trips.find(t => t.id === id);
  if (!trip) return;
  editingId = id;
  companions = [...(trip.companions || [])];
  photos = (trip.photos || []).map(p => ({ dataUrl: p }));
  document.getElementById('modal-title').textContent = 'Edit Trip';
  document.getElementById('trip-name').value = trip.name || '';
  document.getElementById('trip-start').value = trip.start || '';
  document.getElementById('trip-end').value = trip.end || '';
  document.getElementById('trip-notes').value = trip.notes || '';
  document.getElementById('delete-trip').classList.remove('hidden');
  renderCompanionTags();
  renderPhotoPreviews();
  document.getElementById('trip-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('trip-modal').classList.add('hidden');
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.querySelector('#trip-modal .modal-backdrop').addEventListener('click', closeModal);

// Companions
function renderCompanionTags() {
  const wrap = document.getElementById('companion-tags');
  wrap.innerHTML = companions.map((c, i) => `
    <span class="companion-tag">${c}
      <button onclick="removeCompanion(${i})">✕</button>
    </span>`
  ).join('');
}

window.removeCompanion = function(i) {
  companions.splice(i, 1);
  renderCompanionTags();
};

document.getElementById('companion-add').addEventListener('click', addCompanion);
document.getElementById('companion-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); addCompanion(); }
});

function addCompanion() {
  const input = document.getElementById('companion-input');
  const val = input.value.trim();
  if (val && !companions.includes(val)) {
    companions.push(val);
    renderCompanionTags();
  }
  input.value = '';
}

// Photos
document.getElementById('photo-input').addEventListener('change', function () {
  const files = Array.from(this.files);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      photos.push({ dataUrl: e.target.result, name: file.name });
      renderPhotoPreviews();
    };
    reader.readAsDataURL(file);
  });
  this.value = '';
});

function renderPhotoPreviews() {
  const wrap = document.getElementById('photo-previews');
  wrap.innerHTML = photos.map((p, i) => `
    <div class="photo-thumb">
      <img src="${p.dataUrl}" alt="" />
      <button class="remove-photo" onclick="removePhoto(${i})">✕</button>
    </div>`
  ).join('');
}

window.removePhoto = function(i) {
  photos.splice(i, 1);
  renderPhotoPreviews();
};

// Save
document.getElementById('save-trip').addEventListener('click', () => {
  const name = document.getElementById('trip-name').value.trim() || 'Untitled Trip';
  const start = document.getElementById('trip-start').value;
  const end = document.getElementById('trip-end').value;
  const notes = document.getElementById('trip-notes').value.trim();

  if (editingId) {
    const trip = trips.find(t => t.id === editingId);
    Object.assign(trip, { name, start, end, notes, companions: [...companions], photos: photos.map(p => p.dataUrl) });
  } else {
    trips.push({ id: genId(), name, start, end, notes, companions: [...companions], photos: photos.map(p => p.dataUrl) });
  }
  saveTrips(trips);
  closeModal();
  renderDiary();
});

// Delete
document.getElementById('delete-trip').addEventListener('click', () => {
  if (!editingId) return;
  if (!confirm('Delete this trip?')) return;
  trips = trips.filter(t => t.id !== editingId);
  saveTrips(trips);
  closeModal();
  renderDiary();
});

// ── CALENDAR ──
const now = new Date();
calYear = now.getFullYear();
calMonth = now.getMonth();

function tripsOnDate(dateStr) {
  return trips.filter(t => {
    if (!t.start) return false;
    if (!t.end || t.end === t.start) return t.start === dateStr;
    return t.start <= dateStr && dateStr <= t.end;
  });
}

function renderCalendar() {
  const label = document.getElementById('cal-month-label');
  label.textContent = new Date(calYear, calMonth, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const grid = document.getElementById('calendar-grid');
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const todayStr = now.toISOString().slice(0, 10);

  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay = new Date(calYear, calMonth + 1, 0);
  // Monday-based offset
  let startOffset = (firstDay.getDay() + 6) % 7;

  let html = days.map(d => `<div class="cal-day-name">${d}</div>`).join('');

  for (let i = 0; i < startOffset; i++) html += '<div class="cal-day empty"></div>';

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    const hasTrip = tripsOnDate(dateStr).length > 0;
    html += `<div class="cal-day ${isToday ? 'today' : ''} ${hasTrip ? 'has-trip' : ''}" onclick="openDay('${dateStr}')">${d}</div>`;
  }

  grid.innerHTML = html;
}

document.getElementById('cal-prev').addEventListener('click', () => {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
});

document.getElementById('cal-next').addEventListener('click', () => {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
});

window.openDay = function(dateStr) {
  const dayTrips = tripsOnDate(dateStr);
  if (dayTrips.length === 0) return;

  const label = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  document.getElementById('day-modal-title').textContent = label;

  const body = document.getElementById('day-modal-body');
  body.innerHTML = dayTrips.map(trip => {
    const photoGrid = (trip.photos || []).length
      ? `<div class="day-trip-photos">${trip.photos.map(p => `<img src="${p}" />`).join('')}</div>`
      : '';
    const chips = (trip.companions || []).map(c => `<span class="companion-chip">👤 ${c}</span>`).join('');
    const notes = trip.notes ? `<p class="day-trip-notes">${trip.notes}</p>` : '';
    return `<div class="day-trip-entry">
      <h3>${trip.name}</h3>
      ${photoGrid}
      <div class="trip-card-companions" style="margin-bottom:8px">${chips}</div>
      ${notes}
    </div>`;
  }).join('<hr style="margin:12px 0;border:none;border-top:1px solid #eee"/>');

  document.getElementById('day-modal').classList.remove('hidden');
};

document.getElementById('day-modal-close').addEventListener('click', () => {
  document.getElementById('day-modal').classList.add('hidden');
});
document.querySelector('#day-modal .modal-backdrop').addEventListener('click', () => {
  document.getElementById('day-modal').classList.add('hidden');
});

// ── INIT ──
renderDiary();
renderCalendar();
renderMapMarkers();
