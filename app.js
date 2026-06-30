// ── SUPABASE ──
const SUPABASE_URL = 'https://obycapivfpgglwpvgeln.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ieWNhcGl2ZnBnZ2x3cHZnZWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4Mzc2NzMsImV4cCI6MjA5ODQxMzY3M30.zdh1Bl8t43V6I2_Vt3WCASNeE_h2fC8voIhfJ8Evh8g';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── PASSWORD ──
const PASSWORD = 'fayisthebest';
const AUTH_KEY = 'filey_authed';

function isAuthed() { return localStorage.getItem(AUTH_KEY) === '1'; }

document.getElementById('password-btn').addEventListener('click', tryUnlock);
document.getElementById('password-input').addEventListener('keydown', e => { if (e.key === 'Enter') tryUnlock(); });

function tryUnlock() {
  const val = document.getElementById('password-input').value;
  if (val === PASSWORD) {
    localStorage.setItem(AUTH_KEY, '1');
    document.getElementById('lock-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    initApp();
  } else {
    document.getElementById('password-error').classList.remove('hidden');
    document.getElementById('password-input').value = '';
  }
}

if (isAuthed()) {
  document.getElementById('lock-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  initApp();
}

// ── PHOTO COMPRESSION ──
function compressImage(file, maxDim = 1200, quality = 0.75) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width: w, height: h } = img;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
        else { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(resolve, 'image/jpeg', quality);
    };
    img.src = url;
  });
}

// ── MAIN APP ──
async function initApp() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

  // Map
  const map = L.map('map', {
    center: [54.2093, -0.2863], zoom: 14,
    zoomControl: false, dragging: false, scrollWheelZoom: false,
    doubleClickZoom: false, touchZoom: false, keyboard: false, attributionControl: false,
  });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  // State
  let entries = {}; // { "YYYY-MM-DD": { notes, salah, companions, photo_urls } }
  let calYear, calMonth, activeDate = null;
  let pendingPhotos = []; // { url: string, isNew: bool, file?: Blob }
  let pendingCompanions = [];
  const now = new Date();
  calYear = now.getFullYear(); calMonth = now.getMonth();

  // Load all entries from Supabase
  async function fetchEntries() {
    const { data, error } = await db.from('diary_entries').select('*');
    if (error) { console.error(error); return; }
    entries = {};
    (data || []).forEach(row => { entries[row.date] = row; });
  }

  await fetchEntries();
  renderHome();
  renderCalendar();

  // ── STATS ──
  const START_DATE = new Date('2026-03-27');

  function pad(n) { return String(n).padStart(2, '0'); }
  function toKey(y, m, d) { return `${y}-${pad(m+1)}-${pad(d)}`; }
  function todayKey() { return toKey(now.getFullYear(), now.getMonth(), now.getDate()); }

  function datesBetween(a, b) {
    const dates = [], cur = new Date(a);
    while (cur <= b) { dates.push(cur.toISOString().slice(0,10)); cur.setDate(cur.getDate()+1); }
    return dates;
  }

  function hasContent(e) {
    return e && (e.notes || (e.photo_urls && e.photo_urls.length) || e.salah || (e.companions && e.companions.length));
  }

  function computeStats() {
    const allDates = datesBetween(START_DATE, now);
    const fileyDays = allDates.filter(d => hasContent(entries[d]));
    const pct = allDates.length > 0 ? Math.round((fileyDays.length / allDates.length) * 100) : 0;

    const sorted = [...fileyDays].sort();
    let trips = 0;
    sorted.forEach((d, i) => {
      const prev = sorted[i-1];
      if (!prev || (new Date(d) - new Date(prev)) / 86400000 > 1) trips++;
    });

    const salahDays = Object.keys(entries).filter(d => entries[d] && entries[d].salah).sort();
    let salahTrips = 0;
    salahDays.forEach((d, i) => {
      const prev = salahDays[i-1];
      if (!prev || (new Date(d) - new Date(prev)) / 86400000 > 1) salahTrips++;
    });

    const companionCount = {};
    Object.values(entries).forEach(e => {
      (e.companions || []).forEach(c => { companionCount[c] = (companionCount[c] || 0) + 1; });
    });

    return { total: allDates.length, filey: fileyDays.length, pct, trips, salahTrips, companionCount };
  }

  function renderHome() {
    const { total, filey, pct, trips, salahTrips, companionCount } = computeStats();
    document.getElementById('stat-days').textContent = filey;
    document.getElementById('stat-days-sub').textContent = `out of ${total} days since 27 Mar 2026 · ${pct}%`;
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('stat-trips').textContent = trips;
    document.getElementById('stat-salah').textContent = salahTrips;

    const people = Object.entries(companionCount).sort((a,b) => b[1]-a[1]);
    const list = document.getElementById('people-list');
    list.innerHTML = people.length
      ? people.map(([name, count]) => `<div class="person-row"><span class="person-name">👤 ${name}</span><span class="person-count">${count} day${count!==1?'s':''}</span></div>`).join('')
      : '<p class="no-people">Add people when logging a day 👆</p>';
  }

  // ── NAV ──
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('view-' + btn.dataset.view).classList.add('active');
      if (btn.dataset.view === 'home') renderHome();
      if (btn.dataset.view === 'calendar') renderCalendar();
    });
  });

  // ── CALENDAR ──
  function renderCalendar() {
    document.getElementById('month-label').textContent =
      new Date(calYear, calMonth, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    const cal = document.getElementById('calendar');
    const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
    const today = todayKey();

    let html = '';
    for (let i = 0; i < firstDow; i++) html += '<div class="day empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const key = toKey(calYear, calMonth, d);
      const e = entries[key];
      const has = hasContent(e);
      const thumb = e && e.photo_urls && e.photo_urls[0];
      const salah = e && e.salah;
      if (has) {
        html += `<div class="day has-entry${key===today?' today':''}" data-key="${key}">
          ${thumb ? `<img class="day-bg" src="${thumb}" />` : '<div class="day-bg-plain"></div>'}
          <div class="day-inner">
            <span class="day-emoji">${salah?'🐱':'🏖️'}</span>
            <span class="day-num">${d}</span>
          </div>
        </div>`;
      } else {
        html += `<div class="day${key===today?' today':''}" data-key="${key}">
          <div class="day-inner"><span class="day-num">${d}</span></div>
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

  // ── MODAL ──
  function setLoading(on) {
    document.getElementById('modal-loading').classList.toggle('hidden', !on);
  }

  function setDateLabel(key) {
    document.getElementById('modal-date-label').textContent =
      new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function showScrapbook(key) {
    const e = entries[key];
    const photos = e.photo_urls || [];
    const photoEl = document.getElementById('scrapbook-photos');
    photoEl.className = 'scrapbook-photos' + (photos.length===1?' one':photos.length===3?' three':'');
    photoEl.innerHTML = photos.map(p => `<div class="scrapbook-img"><img src="${p}" /></div>`).join('');

    const chips = [];
    if (e.salah) chips.push('🐱 Salah');
    (e.companions||[]).forEach(c => chips.push('👤 '+c));
    document.getElementById('scrapbook-chips').innerHTML = chips.map(c => `<span class="scrapbook-chip">${c}</span>`).join('');
    document.getElementById('scrapbook-notes').textContent = e.notes || '';

    document.getElementById('scrapbook-view').classList.remove('hidden');
    document.getElementById('scrapbook-footer').classList.remove('hidden');
    document.getElementById('edit-view').classList.add('hidden');
    document.getElementById('edit-footer').classList.add('hidden');
  }

  function showEditForm(key) {
    const e = entries[key] || {};
    pendingPhotos = (e.photo_urls || []).map(url => ({ url, isNew: false }));
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
    if (hasContent(entries[key])) {
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

  document.getElementById('remove-btn').addEventListener('click', async () => {
    if (!activeDate) return;
    setLoading(true);
    // delete photos from storage
    const e = entries[activeDate];
    if (e && e.photo_urls && e.photo_urls.length) {
      const paths = e.photo_urls.map(url => url.split('/photos/')[1]);
      await db.storage.from('photos').remove(paths);
    }
    await db.from('diary_entries').delete().eq('date', activeDate);
    delete entries[activeDate];
    setLoading(false);
    renderCalendar();
    renderHome();
    closeModal();
  });

  // Companions
  function renderCompanionTags() {
    document.getElementById('companion-tags').innerHTML = pendingCompanions.map((c,i) => `
      <span class="companion-tag">${c}<button onclick="window._removeCompanion(${i})">✕</button></span>`).join('');
  }
  window._removeCompanion = i => { pendingCompanions.splice(i,1); renderCompanionTags(); };

  document.getElementById('companion-add').addEventListener('click', addCompanion);
  document.getElementById('companion-input').addEventListener('keydown', e => { if (e.key==='Enter') { e.preventDefault(); addCompanion(); }});
  function addCompanion() {
    const input = document.getElementById('companion-input');
    const val = input.value.trim();
    if (val && !pendingCompanions.includes(val)) { pendingCompanions.push(val); renderCompanionTags(); }
    input.value = '';
  }

  // Photos
  document.getElementById('photo-input').addEventListener('change', async function () {
    const files = Array.from(this.files);
    for (const file of files) {
      const blob = await compressImage(file);
      const url = URL.createObjectURL(blob);
      pendingPhotos.push({ url, isNew: true, blob });
      renderPhotoGrid();
    }
    this.value = '';
  });

  function renderPhotoGrid() {
    document.getElementById('photo-grid').innerHTML = pendingPhotos.map((p,i) => `
      <div class="photo-thumb">
        <img src="${p.url}" />
        <button class="del" onclick="window._removePhoto(${i})">✕</button>
      </div>`).join('');
  }
  window._removePhoto = i => { pendingPhotos.splice(i,1); renderPhotoGrid(); };

  // Save
  document.getElementById('save-btn').addEventListener('click', async () => {
    if (!activeDate) return;
    setLoading(true);

    const notes = document.getElementById('notes-input').value.trim();
    const salah = document.getElementById('salah-toggle').checked;

    // Upload new photos to Supabase Storage
    const photoUrls = [];
    for (const p of pendingPhotos) {
      if (!p.isNew) {
        photoUrls.push(p.url);
      } else {
        const filename = `${activeDate}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const { error } = await db.storage.from('photos').upload(filename, p.blob, { contentType: 'image/jpeg' });
        if (!error) {
          const { data } = db.storage.from('photos').getPublicUrl(filename);
          photoUrls.push(data.publicUrl);
        }
      }
    }

    const row = { date: activeDate, notes, salah, companions: pendingCompanions, photo_urls: photoUrls };

    if (notes || photoUrls.length || salah || pendingCompanions.length) {
      await db.from('diary_entries').upsert(row, { onConflict: 'date' });
      entries[activeDate] = row;
      setLoading(false);
      renderCalendar();
      renderHome();
      showScrapbook(activeDate);
    } else {
      await db.from('diary_entries').delete().eq('date', activeDate);
      delete entries[activeDate];
      setLoading(false);
      renderCalendar();
      renderHome();
      closeModal();
    }
  });
}
