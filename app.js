if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

// MAP (background, no interaction)
const map = L.map('map', {
  center: [54.2093, -0.2863], zoom: 14,
  zoomControl: false, dragging: false, scrollWheelZoom: false,
  doubleClickZoom: false, touchZoom: false, keyboard: false, attributionControl: false,
});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

// STORAGE
const KEY = 'filey_entries';
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
function save(data) { localStorage.setItem(KEY, JSON.stringify(data)); }

// entries: { "2024-07-20": { notes, photos: [], salah: bool, companions: [] } }
let entries = load();

// STATE
let calYear, calMonth, activeDate = null, pendingPhotos = [], pendingCompanions = [];
const now = new Date();
calYear = now.getFullYear(); calMonth = now.getMonth();

// STATS — start date: 6th July 2024
const START_DATE = new Date('2026-03-27');

function pad(n) { return String(n).padStart(2, '0'); }
function toKey(y, m, d) { return `${y}-${pad(m+1)}-${pad(d)}`; }
function todayKey() { return toKey(now.getFullYear(), now.getMonth(), now.getDate()); }

function datesBetween(a, b) {
  // returns array of "YYYY-MM-DD" strings from a up to and including b
  const dates = [], cur = new Date(a);
  while (cur <= b) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function computeStats() {
  const allDates = datesBetween(START_DATE, now);
  const totalDays = allDates.length;

  // days with any entry
  const fileyDays = allDates.filter(d => {
    const e = entries[d];
    return e && (e.notes || (e.photos && e.photos.length) || e.salah || (e.companions && e.companions.length));
  });
  const fileyCount = fileyDays.length;
  const pct = totalDays > 0 ? Math.round((fileyCount / totalDays) * 100) : 0;

  // count trips (consecutive groups)
  const sortedFiley = [...fileyDays].sort();
  let trips = 0;
  for (let i = 0; i < sortedFiley.length; i++) {
    const prev = sortedFiley[i - 1];
    if (!prev) { trips++; continue; }
    const diff = (new Date(sortedFiley[i]) - new Date(prev)) / 86400000;
    if (diff > 1) trips++;
  }

  // salah trips
  const salahDays = Object.keys(entries).filter(d => entries[d] && entries[d].salah);
  const sortedSalah = [...salahDays].sort();
  let salahTrips = 0;
  for (let i = 0; i < sortedSalah.length; i++) {
    const prev = sortedSalah[i - 1];
    if (!prev) { if (sortedSalah.length) salahTrips++; continue; }
    const diff = (new Date(sortedSalah[i]) - new Date(prev)) / 86400000;
    if (diff > 1) salahTrips++;
  }

  // companions tally
  const companionCount = {};
  Object.values(entries).forEach(e => {
    (e.companions || []).forEach(c => {
      companionCount[c] = (companionCount[c] || 0) + 1;
    });
  });

  return { totalDays, fileyCount, pct, trips, salahTrips, companionCount };
}

function renderHome() {
  const { totalDays, fileyCount, pct, trips, salahTrips, companionCount } = computeStats();

  document.getElementById('stat-days').textContent = fileyCount;
  document.getElementById('stat-days-sub').textContent = `out of ${totalDays} days since 27 Mar 2026 · ${pct}%`;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('stat-trips').textContent = trips;
  document.getElementById('stat-salah').textContent = salahTrips;

  const people = Object.entries(companionCount).sort((a, b) => b[1] - a[1]);
  const list = document.getElementById('people-list');
  if (people.length === 0) {
    list.innerHTML = '<p class="no-people">Add people when logging a day 👆</p>';
  } else {
    list.innerHTML = people.map(([name, count]) => `
      <div class="person-row">
        <span class="person-name">👤 ${name}</span>
        <span class="person-count">${count} day${count !== 1 ? 's' : ''}</span>
      </div>`).join('');
  }
}

// NAV
const navBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');
navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    navBtns.forEach(b => b.classList.remove('active'));
    views.forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-' + btn.dataset.view).classList.add('active');
    if (btn.dataset.view === 'home') renderHome();
    if (btn.dataset.view === 'calendar') renderCalendar();
  });
});

// CALENDAR
function renderCalendar() {
  document.getElementById('month-label').textContent =
    new Date(calYear, calMonth, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const cal = document.getElementById('calendar');
  const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = todayKey();

  let html = '';
  for (let i = 0; i < firstDow; i++) html += '<div class="day empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const key = toKey(calYear, calMonth, d);
    const e = entries[key];
    const hasEntry = e && (e.notes || (e.photos && e.photos.length) || e.salah || (e.companions && e.companions.length));
    const salah = e && e.salah;
    const thumb = e && e.photos && e.photos[0];
    if (hasEntry) {
      html += `<div class="day has-entry${key === today ? ' today' : ''}" data-key="${key}">
        ${thumb ? `<img class="day-bg" src="${thumb}" />` : `<div class="day-bg" style="background:rgba(245,222,170,0.88)"></div>`}
        <div class="day-inner">
          <span class="day-emoji">${salah ? '🐱' : '🏖️'}</span>
          <span class="day-num">${d}</span>
        </div>
      </div>`;
    } else {
      html += `<div class="day${key === today ? ' today' : ''}" data-key="${key}">
        <div class="day-inner">
          <span class="day-num">${d}</span>
        </div>
      </div>`;
    }
  }
  cal.innerHTML = html;
  cal.querySelectorAll('.day:not(.empty)').forEach(el => {
    el.addEventListener('click', () => openDay(el.dataset.key));
  });
}

document.getElementById('prev-btn').addEventListener('click', () => {
  calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
});
document.getElementById('next-btn').addEventListener('click', () => {
  calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
});

// MODAL
function setDateLabel(key) {
  document.getElementById('modal-date-label').textContent =
    new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
}

function showScrapbook(key) {
  const e = entries[key];
  // photos
  const photos = e.photos || [];
  const photoEl = document.getElementById('scrapbook-photos');
  photoEl.className = 'scrapbook-photos' + (photos.length === 1 ? ' one' : photos.length === 3 ? ' three' : '');
  photoEl.innerHTML = photos.map(p => `<div class="scrapbook-img"><img src="${p}" /></div>`).join('');

  // chips
  const chips = [];
  if (e.salah) chips.push('🐱 Salah');
  (e.companions || []).forEach(c => chips.push('👤 ' + c));
  document.getElementById('scrapbook-chips').innerHTML = chips.map(c => `<span class="scrapbook-chip">${c}</span>`).join('');

  // notes
  document.getElementById('scrapbook-notes').textContent = e.notes || '';

  document.getElementById('scrapbook-view').classList.remove('hidden');
  document.getElementById('scrapbook-footer').classList.remove('hidden');
  document.getElementById('edit-view').classList.add('hidden');
  document.getElementById('edit-footer').classList.add('hidden');
}

function showEditForm(key) {
  const e = entries[key] || {};
  pendingPhotos = (e.photos || []).map(p => ({ dataUrl: p }));
  pendingCompanions = [...(e.companions || [])];
  document.getElementById('notes-input').value = e.notes || '';
  document.getElementById('salah-toggle').checked = !!e.salah;
  renderCompanionTags();
  renderPhotoGrid();

  document.getElementById('edit-view').classList.remove('hidden');
  document.getElementById('edit-footer').classList.remove('hidden');
  document.getElementById('scrapbook-view').classList.add('hidden');
  document.getElementById('scrapbook-footer').classList.add('hidden');
}

function openDay(key) {
  activeDate = key;
  setDateLabel(key);
  const e = entries[key];
  const hasEntry = e && (e.notes || (e.photos && e.photos.length) || e.salah || (e.companions && e.companions.length));
  if (hasEntry) {
    showScrapbook(key);
  } else {
    showEditForm(key);
  }
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  activeDate = null; pendingPhotos = []; pendingCompanions = [];
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.querySelector('.backdrop').addEventListener('click', closeModal);
document.getElementById('edit-btn').addEventListener('click', () => showEditForm(activeDate));
document.getElementById('remove-btn').addEventListener('click', () => {
  if (!activeDate) return;
  delete entries[activeDate];
  save(entries);
  renderCalendar();
  closeModal();
});

// companions
function renderCompanionTags() {
  document.getElementById('companion-tags').innerHTML = pendingCompanions.map((c, i) => `
    <span class="companion-tag">${c}
      <button onclick="removeCompanion(${i})">✕</button>
    </span>`).join('');
}
window.removeCompanion = function(i) { pendingCompanions.splice(i, 1); renderCompanionTags(); };

document.getElementById('companion-add').addEventListener('click', addCompanion);
document.getElementById('companion-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addCompanion(); } });
function addCompanion() {
  const input = document.getElementById('companion-input');
  const val = input.value.trim();
  if (val && !pendingCompanions.includes(val)) { pendingCompanions.push(val); renderCompanionTags(); }
  input.value = '';
}

// photos
document.getElementById('photo-input').addEventListener('change', function () {
  Array.from(this.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => { pendingPhotos.push({ dataUrl: e.target.result }); renderPhotoGrid(); };
    reader.readAsDataURL(file);
  });
  this.value = '';
});
function renderPhotoGrid() {
  document.getElementById('photo-grid').innerHTML = pendingPhotos.map((p, i) => `
    <div class="photo-thumb">
      <img src="${p.dataUrl}" />
      <button class="del" onclick="removePhoto(${i})">✕</button>
    </div>`).join('');
}
window.removePhoto = function(i) { pendingPhotos.splice(i, 1); renderPhotoGrid(); };

// save
document.getElementById('save-btn').addEventListener('click', () => {
  if (!activeDate) return;
  const notes = document.getElementById('notes-input').value.trim();
  const salah = document.getElementById('salah-toggle').checked;
  if (notes || pendingPhotos.length || salah || pendingCompanions.length) {
    entries[activeDate] = { notes, photos: pendingPhotos.map(p => p.dataUrl), salah, companions: [...pendingCompanions] };
    save(entries);
    renderCalendar();
    showScrapbook(activeDate);
  } else {
    delete entries[activeDate];
    save(entries);
    renderCalendar();
    closeModal();
  }
});

// INIT
renderHome();
renderCalendar();
