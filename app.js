if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

const KEY = 'filey_entries';

function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
function save(data) { localStorage.setItem(KEY, JSON.stringify(data)); }

let entries = load(); // { "2024-07-20": { notes, photos: [dataUrl] } }
let year, month;
let activeDate = null;
let pendingPhotos = []; // { dataUrl }

const now = new Date();
year = now.getFullYear();
month = now.getMonth();

// ── CALENDAR ──
function pad(n) { return String(n).padStart(2, '0'); }
function toKey(y, m, d) { return `${y}-${pad(m+1)}-${pad(d)}`; }
function todayKey() { return toKey(now.getFullYear(), now.getMonth(), now.getDate()); }

function renderCalendar() {
  document.getElementById('month-label').textContent =
    new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const cal = document.getElementById('calendar');
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayKey();

  let html = '';
  for (let i = 0; i < firstDow; i++) html += '<div class="day empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const key = toKey(year, month, d);
    const isToday = key === today;
    const entry = entries[key];
    const hasEntry = entry && (entry.notes || (entry.photos && entry.photos.length));
    html += `<div class="day${isToday ? ' today' : ''}${hasEntry ? ' has-entry' : ''}" data-key="${key}">
      <span class="day-num">${d}</span>
      ${hasEntry ? '<span class="day-emoji">🏖️</span>' : ''}
    </div>`;
  }
  cal.innerHTML = html;

  cal.querySelectorAll('.day:not(.empty)').forEach(el => {
    el.addEventListener('click', () => openDay(el.dataset.key));
  });
}

document.getElementById('prev-btn').addEventListener('click', () => {
  month--; if (month < 0) { month = 11; year--; }
  renderCalendar();
});
document.getElementById('next-btn').addEventListener('click', () => {
  month++; if (month > 11) { month = 0; year++; }
  renderCalendar();
});

// ── MODAL ──
function openDay(key) {
  activeDate = key;
  const entry = entries[key] || {};
  pendingPhotos = (entry.photos || []).map(p => ({ dataUrl: p }));

  const [y, m, d] = key.split('-');
  const label = new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  document.getElementById('modal-date-label').textContent = label;
  document.getElementById('notes-input').value = entry.notes || '';
  renderPhotoGrid();
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  activeDate = null;
  pendingPhotos = [];
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.querySelector('.backdrop').addEventListener('click', closeModal);

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

window.removePhoto = function(i) {
  pendingPhotos.splice(i, 1);
  renderPhotoGrid();
};

// save
document.getElementById('save-btn').addEventListener('click', () => {
  if (!activeDate) return;
  const notes = document.getElementById('notes-input').value.trim();
  if (notes || pendingPhotos.length) {
    entries[activeDate] = { notes, photos: pendingPhotos.map(p => p.dataUrl) };
  } else {
    delete entries[activeDate];
  }
  save(entries);
  renderCalendar();
  closeModal();
});

renderCalendar();
