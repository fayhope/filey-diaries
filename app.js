// ── SUPABASE ──
const SUPABASE_URL = 'https://obycapivfpgglwpvgeln.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ieWNhcGl2ZnBnZ2x3cHZnZWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4Mzc2NzMsImV4cCI6MjA5ODQxMzY3M30.zdh1Bl8t43V6I2_Vt3WCASNeE_h2fC8voIhfJ8Evh8g';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── PASSWORD ──
const PASSWORD = 'fayisthebest';
const AUTH_KEY = 'filey_authed';

document.getElementById('password-btn').addEventListener('click', tryUnlock);
document.getElementById('password-input').addEventListener('keydown', e => { if (e.key === 'Enter') tryUnlock(); });

function tryUnlock() {
  if (document.getElementById('password-input').value === PASSWORD) {
    localStorage.setItem(AUTH_KEY, '1');
    document.getElementById('lock-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    startApp();
  } else {
    document.getElementById('password-error').classList.remove('hidden');
    document.getElementById('password-input').value = '';
  }
}

if (localStorage.getItem(AUTH_KEY) === '1') {
  document.getElementById('lock-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  startApp();
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

// ── APP ──
function startApp() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

  // Map
  const map = L.map('map', {
    center: [54.2093, -0.2863], zoom: 14,
    zoomControl: false, dragging: false, scrollWheelZoom: false,
    doubleClickZoom: false, touchZoom: false, keyboard: false, attributionControl: false,
  });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  // State
  let entries = {};
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth();
  let activeDate = null;
  let pendingPhotos = [];
  let pendingCompanions = [];
  const now = new Date();
  const START_DATE = new Date('2026-03-27');

  // ── HELPERS ──
  const pad = n => String(n).padStart(2, '0');
  const toKey = (y, m, d) => `${y}-${pad(m+1)}-${pad(d)}`;
  const todayKey = () => toKey(now.getFullYear(), now.getMonth(), now.getDate());
  const hasContent = e => e && (e.notes || (e.photo_urls && e.photo_urls.length) || e.salah || (e.companions && e.companions.length));

  function datesBetween(a, b) {
    const dates = [], cur = new Date(a);
    while (cur <= b) { dates.push(cur.toISOString().slice(0,10)); cur.setDate(cur.getDate()+1); }
    return dates;
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
      if (btn.dataset.view === 'scrapbook') renderScrapbook();
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
          <div class="day-inner"><span class="day-emoji">${salah?'🐱':'🏖️'}</span><span class="day-num">${d}</span></div>
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
    calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar();
  });
  document.getElementById('next-btn').addEventListener('click', () => {
    calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar();
  });

  // ── HOME ──
  function renderHome() {
    const allDates = datesBetween(START_DATE, now);
    const fileyDays = allDates.filter(d => hasContent(entries[d]));
    const pct = allDates.length ? Math.round(fileyDays.length / allDates.length * 100) : 0;

    let trips = 0;
    [...fileyDays].sort().forEach((d, i, arr) => {
      const prev = arr[i-1];
      if (!prev || (new Date(d) - new Date(prev)) / 86400000 > 1) trips++;
    });

    const salahDays = Object.keys(entries).filter(d => entries[d]?.salah).sort();
    let salahTrips = 0;
    salahDays.forEach((d, i) => {
      const prev = salahDays[i-1];
      if (!prev || (new Date(d) - new Date(prev)) / 86400000 > 1) salahTrips++;
    });

    const companionCount = {};
    Object.values(entries).forEach(e => {
      (e.companions||[]).forEach(c => { companionCount[c] = (companionCount[c]||0) + 1; });
    });

    document.getElementById('stat-days').textContent = fileyDays.length;
    document.getElementById('stat-days-sub').textContent = `out of ${allDates.length} days since 27 Mar 2026 · ${pct}%`;
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('stat-trips').textContent = trips;
    document.getElementById('stat-salah').textContent = salahTrips;

    const people = Object.entries(companionCount).sort((a,b) => b[1]-a[1]);
    document.getElementById('people-list').innerHTML = people.length
      ? people.map(([n,c]) => `<div class="person-row"><span class="person-name">👤 ${n}</span><span class="person-count">${c} day${c!==1?'s':''}</span></div>`).join('')
      : '<p class="no-people">Add people when logging a day 👆</p>';
  }

  // ── MODAL ──
  function setLoading(on) {
    document.getElementById('modal-loading').classList.toggle('hidden', !on);
  }

  function showScrapbook(key) {
    const e = entries[key];
    const photos = e.photo_urls || [];
    const el = document.getElementById('scrapbook-photos');
    el.className = 'scrapbook-photos' + (photos.length===1?' one':photos.length===3?' three':'');
    el.innerHTML = photos.map(p => `<div class="scrapbook-img"><img src="${p}" /></div>`).join('');
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
    pendingPhotos = (e.photo_urls||[]).map(url => ({ url, isNew: false }));
    pendingCompanions = [...(e.companions||[])];
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
    document.getElementById('modal-date-label').textContent =
      new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    hasContent(entries[key]) ? showScrapbook(key) : showEditForm(key);
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
    const e = entries[activeDate];
    if (e?.photo_urls?.length) {
      const paths = e.photo_urls.map(url => url.split('/photos/')[1]).filter(Boolean);
      if (paths.length) await db.storage.from('photos').remove(paths);
    }
    await db.from('diary_entries').delete().eq('date', activeDate);
    delete entries[activeDate];
    setLoading(false);
    renderCalendar(); renderHome(); closeModal();
  });

  // Companions
  function renderCompanionTags() {
    document.getElementById('companion-tags').innerHTML = pendingCompanions.map((c,i) => `
      <span class="companion-tag">${c}<button onclick="window._rc(${i})">✕</button></span>`).join('');
  }
  window._rc = i => { pendingCompanions.splice(i,1); renderCompanionTags(); };

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
    for (const file of Array.from(this.files)) {
      const blob = await compressImage(file);
      pendingPhotos.push({ url: URL.createObjectURL(blob), isNew: true, blob });
      renderPhotoGrid();
    }
    this.value = '';
  });
  function renderPhotoGrid() {
    document.getElementById('photo-grid').innerHTML = pendingPhotos.map((p,i) => `
      <div class="photo-thumb"><img src="${p.url}" /><button class="del" onclick="window._rp(${i})">✕</button></div>`).join('');
  }
  window._rp = i => { pendingPhotos.splice(i,1); renderPhotoGrid(); };

  // Save
  document.getElementById('save-btn').addEventListener('click', async () => {
    if (!activeDate) return;
    setLoading(true);
    const notes = document.getElementById('notes-input').value.trim();
    const salah = document.getElementById('salah-toggle').checked;
    const photoUrls = [];
    for (const p of pendingPhotos) {
      if (!p.isNew) { photoUrls.push(p.url); continue; }
      const filename = `${activeDate}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const { error } = await db.storage.from('photos').upload(filename, p.blob, { contentType: 'image/jpeg' });
      if (!error) photoUrls.push(db.storage.from('photos').getPublicUrl(filename).data.publicUrl);
    }
    const row = { date: activeDate, notes, salah, companions: pendingCompanions, photo_urls: photoUrls };
    if (notes || photoUrls.length || salah || pendingCompanions.length) {
      await db.from('diary_entries').upsert(row, { onConflict: 'date' });
      entries[activeDate] = row;
      setLoading(false);
      renderCalendar(); renderHome(); showScrapbook(activeDate);
    } else {
      await db.from('diary_entries').delete().eq('date', activeDate);
      delete entries[activeDate];
      setLoading(false);
      renderCalendar(); renderHome(); closeModal();
    }
  });

  // ── SCRAPBOOK PAGE ──
  function renderScrapbook() {
    const container = document.getElementById('scrapbook-pages');
    const days = Object.keys(entries).filter(k => hasContent(entries[k])).sort();

    if (!days.length) {
      container.innerHTML = '<div class="sb-no-entries">No entries yet.<br>Start logging your days in the Calendar! 🏖️</div>';
      return;
    }

    // group by month
    const byMonth = {};
    days.forEach(d => {
      const mon = d.slice(0, 7); // "YYYY-MM"
      if (!byMonth[mon]) byMonth[mon] = [];
      byMonth[mon].push(d);
    });

    const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    let html = '';

    Object.keys(byMonth).sort().forEach(mon => {
      const [y, m] = mon.split('-').map(Number);
      const monthName = new Date(y, m-1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      const daysInMonth = new Date(y, m, 0).getDate();
      const firstDow = (new Date(y, m-1, 1).getDay() + 6) % 7;

      // mini calendar
      let calCells = DAYS.map(d => `<div class="sb-cal-name">${d}</div>`).join('');
      for (let i = 0; i < firstDow; i++) calCells += '<div class="sb-cal-day empty"></div>';
      for (let d = 1; d <= daysInMonth; d++) {
        const key = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const e = entries[key];
        const stamped = hasContent(e);
        const salah = e && e.salah;
        calCells += `<div class="sb-cal-day${stamped?' stamped':''}${salah?' salah':''}">${d}</div>`;
      }

      html += `<div class="sb-month-page">
        <div class="sb-month-title">${monthName}</div>
        <div class="sb-mini-cal">${calCells}</div>
      </div>`;

      // day spreads
      byMonth[mon].forEach(key => {
        const e = entries[key];
        const photos = e.photo_urls || [];
        const chips = [];
        if (e.salah) chips.push('🐱 Salah');
        (e.companions||[]).forEach(c => chips.push('👤 '+c));

        const dateLabel = new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long'
        });

        const shown = photos.slice(0, 3);
        const extra = photos.length - shown.length;
        const photoHtml = shown.map((p, i) =>
          `<div class="sb-photo ${shown.length === 2 && i === 0 ? 'sb-photo-half' : shown.length === 2 && i === 1 ? 'sb-photo-half' : ''}">
            <img src="${p}" loading="lazy" />
            ${i === shown.length - 1 && extra > 0 ? `<div class="sb-photo-more">+${extra}</div>` : ''}
          </div>`
        ).join('');

        const chipsHtml = chips.map(c => `<span class="sb-chip">${c}</span>`).join('');

        html += `<div class="sb-spread">
          <div class="sb-page-left">
            <div class="sb-photos">${photoHtml || '<div style="flex:1;display:flex;align-items:center;justify-content:center;font-size:2.5rem;opacity:0.3">🏖️</div>'}</div>
          </div>
          <div class="sb-page-right">
            <div class="sb-day-title">${dateLabel}</div>
            ${chips.length ? `<div class="sb-chips">${chipsHtml}</div>` : ''}
            <p class="sb-text">${e.notes || ''}</p>
          </div>
        </div>`;
      });
    });

    container.innerHTML = html;
  }

  // ── TRIP MODAL ──
  let tripCompanions = [];

  document.getElementById('trip-nav-btn').addEventListener('click', () => {
    tripCompanions = [];
    document.getElementById('trip-start').value = '';
    document.getElementById('trip-end').value = '';
    document.getElementById('trip-notes').value = '';
    document.getElementById('trip-salah').checked = false;
    renderTripTags();
    document.getElementById('trip-modal').classList.remove('hidden');
  });

  document.getElementById('trip-modal-close').addEventListener('click', () => {
    document.getElementById('trip-modal').classList.add('hidden');
  });
  document.getElementById('trip-backdrop').addEventListener('click', () => {
    document.getElementById('trip-modal').classList.add('hidden');
  });

  function renderTripTags() {
    document.getElementById('trip-companion-tags').innerHTML = tripCompanions.map((c,i) => `
      <span class="companion-tag">${c}<button onclick="window._rtc(${i})">✕</button></span>`).join('');
  }
  window._rtc = i => { tripCompanions.splice(i,1); renderTripTags(); };

  document.getElementById('trip-companion-add').addEventListener('click', addTripCompanion);
  document.getElementById('trip-companion-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addTripCompanion(); }
  });
  function addTripCompanion() {
    const input = document.getElementById('trip-companion-input');
    const val = input.value.trim();
    if (val && !tripCompanions.includes(val)) { tripCompanions.push(val); renderTripTags(); }
    input.value = '';
  }

  document.getElementById('trip-save-btn').addEventListener('click', async () => {
    const start = document.getElementById('trip-start').value;
    const end = document.getElementById('trip-end').value || start;
    if (!start) return;

    const notes = document.getElementById('trip-notes').value.trim();
    const salah = document.getElementById('trip-salah').checked;

    document.getElementById('trip-loading').classList.remove('hidden');

    // build one row per day in the range
    const rows = [];
    const cur = new Date(start + 'T12:00:00');
    const last = new Date(end + 'T12:00:00');
    while (cur <= last) {
      const key = cur.toISOString().slice(0,10);
      rows.push({ date: key, notes, salah, companions: [...tripCompanions], photo_urls: entries[key]?.photo_urls || [] });
      cur.setDate(cur.getDate() + 1);
    }

    await db.from('diary_entries').upsert(rows, { onConflict: 'date' });
    rows.forEach(r => { entries[r.date] = r; });

    document.getElementById('trip-loading').classList.add('hidden');
    document.getElementById('trip-modal').classList.add('hidden');
    renderCalendar();
    renderHome();
  });

  // ── LOAD DATA then re-render ──
  renderCalendar();
  renderHome();

  db.from('diary_entries').select('*').then(({ data, error }) => {
    if (error) { console.error('Supabase error:', error); return; }
    entries = {};
    (data||[]).forEach(row => { entries[row.date] = row; });
    renderCalendar();
    renderHome();
  });
}
