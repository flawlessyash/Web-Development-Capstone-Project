/**
 * STREAKR v2 — Habit Tracker
 * app.js
 *
 * New features vs v1:
 *  - Light / dark mode toggle (persisted in localStorage)
 *  - Motivational greeting based on time of day
 *  - Progress ring showing today's completion %
 *  - Emoji picker in add/edit modal
 *  - Suggestion chips in empty state (one-click add)
 *  - Sort by: streak / name / newest / done-first
 *  - Streak milestone badges (7, 21, 30, 100 days)
 *  - Weekly bar chart per habit (replaces dots)
 *  - Confetti burst when marking a habit done
 *  - Weekly completion % stat
 */

'use strict';

/* =============================================
   1. CONSTANTS & STATE
   ============================================= */

const STORAGE_KEY  = 'streakr_habits_v2';
const THEME_KEY    = 'streakr_theme';
const MODAL_IDS    = ['modal-overlay', 'delete-overlay'];

/* Backend API base URL — auto-detects local vs. production */
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : 'https://web-development-capstone-project.onrender.com';

const DAY_LABELS   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MILESTONES   = [
  { days: 100, label: '100 days' },
  { days:  30, label: '30 days'  },
  { days:  21, label: '21 days'  },
  { days:   7, label: '7 days'   },
];

/* Emoji char → Phosphor icon key (backward compat for existing DB rows) */
const ICON_MAP = {
  '⭐': 'ph:star-bold',       '🌟': 'ph:star-bold',
  '🏃': 'ph:person-simple-run-bold',
  '📖': 'ph:book-open-bold',  '📚': 'ph:books-bold',
  '💧': 'ph:drop-bold',
  '🧘': 'ph:person-simple-bold',
  '💪': 'ph:barbell-bold',
  '🎯': 'ph:target-bold',
  '🍎': 'ph:apple-logo-bold',
  '✍️': 'ph:pencil-bold',     '✍': 'ph:pencil-bold',
  '😴': 'ph:moon-bold',
  '🚴': 'ph:bicycle-bold',
  '📓': 'ph:notebook-bold',   '📝': 'ph:notebook-bold',
  '💊': 'ph:pill-bold',
  '📵': 'ph:device-mobile-slash-bold',
  '🎵': 'ph:music-notes-bold','🎶': 'ph:music-notes-bold',
};

/** Resolve stored value (emoji char OR ph: key) → Phosphor icon key */
function resolveIcon(val) {
  if (!val) return 'ph:star-bold';
  if (val.startsWith('ph:')) return val;
  return ICON_MAP[val] || 'ph:star-bold';
}

/** Return an <iconify-icon> HTML string */
function iconEl(key, cls, size) {
  const icon = resolveIcon(key);
  const c    = cls  || '';
  const s    = size || 28;
  return '<iconify-icon icon="' + icon + '" width="' + s + '" class="' + c + '" aria-hidden="true"></iconify-icon>';
}

const GREETINGS = {
  morning:   ['Good morning', 'Rise and shine', 'Morning!'],
  afternoon: ['Good afternoon', 'Keep it up', 'Afternoon!'],
  evening:   ['Good evening', 'Wind down right', 'Evening!'],
  night:     ['Still going?', 'Night owl mode', 'Late night grind'],
};

let habits        = [];
let activeFilter  = 'all';
let searchQuery   = '';
let sortMode      = 'newest';
let habitToDelete = null;

/* =============================================
   2. API DATA LOADING
   ============================================= */

async function loadHabits() {
  try {
    const res = await fetch(`${API_BASE}/api/habits`);
    if (!res.ok) throw new Error('Failed to fetch habits');
    const data = await res.json();
    return data.map(h => ({
      id:         h.habit_id,
      name:       h.title,
      category:   h.category,
      emoji:      h.emoji,
      desc:       h.description,
      goal:       h.goal,
      streak:     h.current_streak,
      bestStreak: h.best_streak,
      history:    h.history || [],
      createdAt:  h.created_at || todayISO()
    }));
  } catch (err) {
    console.error(err);
    showToast('❌ Error loading habits');
    return [];
  }
}

/* =============================================
   3. HABIT CRUD (API)
   ============================================= */

async function addHabit(name, category, emoji, desc, goal) {
  try {
    const res = await fetch(`${API_BASE}/api/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: name, category, emoji, description: desc, goal })
    });
    if (!res.ok) throw new Error('Failed to add habit');
    const h = await res.json();
    
    habits.unshift({
      id:         h.habit_id,
      name:       h.title,
      category:   h.category,
      emoji:      h.emoji,
      desc:       h.description,
      goal:       h.goal,
      streak:     h.current_streak,
      bestStreak: h.best_streak,
      history:    h.history || [],
      createdAt:  h.created_at || todayISO()
    });
    showToast('✅ Habit added!');
    renderAll();
  } catch (err) {
    console.error(err);
    showToast('❌ Error adding habit');
  }
}

async function updateHabit(id, patch) {
  try {
    const existing = habits.find(h => h.id === id);
    const payload = {
      title:       patch.name !== undefined ? patch.name : existing.name,
      category:    patch.category !== undefined ? patch.category : existing.category,
      emoji:       patch.emoji !== undefined ? patch.emoji : existing.emoji,
      description: patch.desc !== undefined ? patch.desc : existing.desc,
      goal:        patch.goal !== undefined ? patch.goal : existing.goal,
    };
    const res = await fetch(`${API_BASE}/api/habits/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to update habit');
    
    updateHabitState(id, patch);
    showToast('✏️ Habit updated!');
    renderAll();
  } catch (err) {
    console.error(err);
    showToast('❌ Error updating habit');
  }
}

async function deleteHabit(id) {
  try {
    const res = await fetch(`${API_BASE}/api/habits/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete habit');
    habits = habits.filter(h => h.id !== id);
    showToast('🗑️ Habit deleted.');
    renderAll();
  } catch (err) {
    console.error(err);
    showToast('❌ Error deleting habit');
  }
}

async function markDone(id) {
  const h = habits.find(h => h.id === id);
  if (!h || isDoneToday(h)) return;

  try {
    const res = await fetch(`${API_BASE}/api/habits/${id}/log`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to log habit');
    }
    const data = await res.json();
    
    const today = todayISO();
    const updatedHistory = [...h.history, today];
    
    updateHabitState(id, { 
      history: updatedHistory, 
      streak: data.current_streak, 
      bestStreak: data.best_streak 
    });
    
    fireConfetti();
    showToast('🔥 Streak updated! Keep it up!');
    renderAll();
  } catch (err) {
    console.error(err);
    showToast('❌ Error logging habit');
  }
}

function updateHabitState(id, patch) {
  habits = habits.map(h => h.id === id ? { ...h, ...patch } : h);
}

/* =============================================
   4. DATE HELPERS
   ============================================= */

function todayISO() { return new Date().toISOString().slice(0, 10); }

function offsetDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function lastNDays(n) {
  return Array.from({ length: n }, (_, i) => offsetDate(i - n + 1));
}

function isDoneToday(h) { return h.history.includes(todayISO()); }

/** Returns the 3-letter day name for an ISO date string */
function dayLabel(iso) {
  const d = new Date(iso + 'T12:00:00');
  return DAY_LABELS[d.getDay()];
}

/* =============================================
   5. SORTING & FILTERING
   ============================================= */

function getSortedFilteredHabits() {
  let list = habits.filter(h => {
    const matchFilter = activeFilter === 'all' || h.category === activeFilter;
    const matchSearch = h.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchFilter && matchSearch;
  });

  switch (sortMode) {
    case 'streak':  list.sort((a, b) => b.streak - a.streak);           break;
    case 'name':    list.sort((a, b) => a.name.localeCompare(b.name));   break;
    case 'done':    list.sort((a, b) => isDoneToday(b) - isDoneToday(a));break;
    case 'newest':
    default:        /* already in insertion order (newest first) */       break;
  }
  return list;
}

/* =============================================
   6. MILESTONE BADGE
   ============================================= */

function getMilestoneBadge(streak) {
  for (const m of MILESTONES) {
    if (streak >= m.days) return m.label;
  }
  return null;
}

/* =============================================
   7. STATS
   ============================================= */

function calcWeeklyRate() {
  if (!habits.length) return 0;
  const days = lastNDays(7);
  let done = 0, total = habits.length * 7;
  habits.forEach(h => days.forEach(d => { if (h.history.includes(d)) done++; }));
  return Math.round((done / total) * 100);
}

/* =============================================
   8. RENDER
   ============================================= */

function renderAll() {
  renderStats();
  renderHabitGrid();
}

function renderStats() {
  const total = habits.length;
  const done  = habits.filter(isDoneToday).length;
  const best  = total ? Math.max(...habits.map(h => h.bestStreak)) : 0;
  const rate  = calcWeeklyRate();

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-done').textContent  = done;
  document.getElementById('stat-best').textContent  = best;
  document.getElementById('stat-week').textContent  = rate + '%';

  // Progress ring
  const pct = total ? Math.round((done / total) * 100) : 0;
  const circumference = 2 * Math.PI * 32; // 201.06
  const offset = circumference - (pct / 100) * circumference;
  const ringFill = document.getElementById('ring-fill');
  if (ringFill) {
    ringFill.style.strokeDasharray  = circumference;
    ringFill.style.strokeDashoffset = offset;
  }
  document.getElementById('ring-percent').textContent = pct + '%';
}

function renderHabitGrid() {
  const grid  = document.getElementById('habit-grid');
  const empty = document.getElementById('empty-state');
  const list  = getSortedFilteredHabits();

  grid.innerHTML = '';

  if (!list.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  list.forEach(h => grid.appendChild(buildCard(h)));
}

/* =============================================
   9. HABIT CARD BUILDER
   ============================================= */

function buildCard(h) {
  const done      = isDoneToday(h);
  const days      = lastNDays(7);
  const milestone = getMilestoneBadge(h.streak);

  const card = document.createElement('article');
  card.className         = `habit-card${done ? ' habit-card--done' : ''}`;
  card.dataset.id        = h.id;
  card.dataset.category  = h.category;
  card.setAttribute('role', 'listitem');

  // Build 7-day bar chart HTML
  const bars = days.map((day, i) => {
    const isToday    = i === days.length - 1;
    const isDoneDay  = h.history.includes(day);
    const height     = isDoneDay ? 28 : 8;
    const cls        = [
      'chart-bar',
      isDoneDay  ? 'chart-bar--done'  : '',
      isToday    ? 'chart-bar--today' : '',
    ].filter(Boolean).join(' ');

    return `
      <div class="chart-bar-wrap">
        <div class="${cls}" style="height:${height}px" title="${day}${isDoneDay ? ' ✓' : ''}"></div>
        <span class="chart-day">${dayLabel(day)}</span>
      </div>`;
  }).join('');

  card.innerHTML = `
    <div class="habit-card__top">
        <div class="habit-card__left">
        <div class="habit-card__icon-wrap habit-card__icon-wrap--${h.category}">
          ${iconEl(h.emoji, 'habit-card__icon', 32)}
        </div>
        <div class="habit-card__info">
          <h3 class="habit-card__name" title="${escapeHtml(h.name)}">${escapeHtml(h.name)}</h3>
          <div class="habit-card__meta">
            <span class="category-badge category-badge--${h.category}">${h.category}</span>
            ${milestone ? `<span class="milestone-badge">${milestone}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="habit-card__actions">
        <button class="btn btn--icon" data-action="edit"   data-id="${h.id}" aria-label="Edit ${escapeHtml(h.name)}"   title="Edit">✎</button>
        <button class="btn btn--icon" data-action="delete" data-id="${h.id}" aria-label="Delete ${escapeHtml(h.name)}" title="Delete">✕</button>
      </div>
    </div>

    ${h.desc ? `<p class="habit-card__desc">"${escapeHtml(h.desc)}"</p>` : ''}

    <div class="habit-card__streak">
      <div class="streak-info">
        <span class="streak-count">${h.streak}</span>
        <span class="streak-label">day streak</span>
      </div>
      <div class="streak-right">
        <span class="streak-flame" aria-label="${done ? 'On fire!' : 'Not done yet'}">${done ? '🔥' : '○'}</span>
        ${h.bestStreak > 0 ? `<span class="streak-best">best: ${h.bestStreak}</span>` : ''}
      </div>
    </div>

    <div class="habit-card__chart" aria-label="Last 7 days activity">${bars}</div>

    <div class="habit-card__footer">
      <button
        class="mark-done-btn${done ? ' done' : ''}"
        data-action="mark-done" data-id="${h.id}"
        ${done ? 'disabled aria-disabled="true"' : ''}
        aria-label="${done ? 'Already done today' : 'Mark as done today'}"
      >${done ? '✓ Done today' : '○ Mark as done'}</button>
    </div>
  `;

  return card;
}

/* =============================================
   10. MODAL HELPERS
   ============================================= */

function showModal(id) {
  MODAL_IDS.forEach(mid => { document.getElementById(mid).hidden = mid !== id; });
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).hidden = true;
  const anyOpen = MODAL_IDS.some(mid => !document.getElementById(mid).hidden);
  if (!anyOpen) document.body.style.overflow = '';
}

function openAddModal(prefill = {}) {
  document.getElementById('modal-title').textContent  = 'Add Habit';
  document.getElementById('habit-id').value           = '';
  document.getElementById('habit-name').value         = prefill.name     || '';
  document.getElementById('habit-category').value     = prefill.category || 'health';
  document.getElementById('habit-desc').value         = '';
  document.getElementById('habit-goal').value         = 'once';
  setEmoji(prefill.emoji ? resolveIcon(prefill.emoji) : 'ph:star-bold');
  clearFormErrors();
  showModal('modal-overlay');
  setTimeout(() => document.getElementById('habit-name').focus(), 50);
}

function openEditModal(id) {
  const h = habits.find(h => h.id === id);
  if (!h) return;
  document.getElementById('modal-title').textContent  = 'Edit Habit';
  document.getElementById('habit-id').value           = h.id;
  document.getElementById('habit-name').value         = h.name;
  document.getElementById('habit-category').value     = h.category;
  document.getElementById('habit-desc').value         = h.desc;
  document.getElementById('habit-goal').value         = h.goal;
  setEmoji(resolveIcon(h.emoji));
  clearFormErrors();
  showModal('modal-overlay');
  setTimeout(() => document.getElementById('habit-name').focus(), 50);
}

function openDeleteModal(id) {
  habitToDelete = id;
  showModal('delete-overlay');
}

/* =============================================
   11. EMOJI PICKER
   ============================================= */

function setEmoji(emoji) {
  document.getElementById('habit-emoji').value = emoji;
  document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.classList.toggle('emoji-btn--active', btn.dataset.emoji === emoji);
  });
}

/* =============================================
   12. FORM VALIDATION
   ============================================= */

function validateForm() {
  clearFormErrors();
  const name = document.getElementById('habit-name').value.trim();
  if (!name) {
    showFieldError('habit-name', 'name-error', 'Habit name is required.');
    return false;
  }
  if (name.length < 2) {
    showFieldError('habit-name', 'name-error', 'Name must be at least 2 characters.');
    return false;
  }
  return true;
}

function showFieldError(inputId, errorId, msg) {
  document.getElementById(inputId).classList.add('form-input--error');
  document.getElementById(errorId).textContent = msg;
}
function clearFormErrors() {
  document.querySelectorAll('.form-input--error').forEach(el => el.classList.remove('form-input--error'));
  document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
}

/* =============================================
   13. CONFETTI
   ============================================= */

function fireConfetti() {
  const canvas  = document.getElementById('confetti-canvas');
  const ctx     = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors  = ['#e8920a', '#4caf78', '#5b9cf6', '#a78bfa', '#f0efe8'];
  const pieces  = Array.from({ length: 80 }, () => ({
    x:    Math.random() * canvas.width,
    y:    Math.random() * -canvas.height,
    size: Math.random() * 8 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    speed: Math.random() * 3 + 2,
    angle: Math.random() * 360,
    spin:  (Math.random() - 0.5) * 6,
    drift: (Math.random() - 0.5) * 2,
  }));

  let frame;
  let elapsed = 0;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.angle * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, 1 - elapsed / 120);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
      ctx.restore();

      p.y     += p.speed;
      p.x     += p.drift;
      p.angle += p.spin;
    });
    elapsed++;
    if (elapsed < 140) { frame = requestAnimationFrame(draw); }
    else { ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  cancelAnimationFrame(frame);
  elapsed = 0;
  draw();
}

/* =============================================
   14. TOAST
   ============================================= */

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('toast--show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('toast--show'), 2600);
}

/* =============================================
   15. THEME
   ============================================= */

function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'dark';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  document.getElementById('theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/* =============================================
   16. GREETING
   ============================================= */

function renderGreeting() {
  const h = new Date().getHours();
  let pool;
  if      (h >= 5  && h < 12) pool = GREETINGS.morning;
  else if (h >= 12 && h < 17) pool = GREETINGS.afternoon;
  else if (h >= 17 && h < 21) pool = GREETINGS.evening;
  else                         pool = GREETINGS.night;

  const text = pool[Math.floor(Math.random() * pool.length)];
  const el   = document.getElementById('greeting');
  if (el) el.textContent = text + ' 👋';
}

/* =============================================
   17. UTILITY
   ============================================= */

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
}

/* =============================================
   18. EVENT LISTENERS
   ============================================= */

function initEvents() {
  // Theme toggle
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  // Open modal
  document.getElementById('open-modal-btn').addEventListener('click', () => openAddModal());
  document.getElementById('empty-add-btn').addEventListener('click',  () => openAddModal());

  // Suggestion chips (empty state)
  document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => openAddModal({
      name:     chip.dataset.name,
      category: chip.dataset.category,
      emoji:    chip.dataset.emoji,
    }));
  });

  // Close modals
  document.getElementById('close-modal-btn').addEventListener('click',  () => closeModal('modal-overlay'));
  document.getElementById('cancel-modal-btn').addEventListener('click', () => closeModal('modal-overlay'));
  document.getElementById('cancel-delete-btn').addEventListener('click',() => closeModal('delete-overlay'));

  // Close on backdrop click
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('modal-overlay');
  });
  document.getElementById('delete-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('delete-overlay');
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal('modal-overlay'); closeModal('delete-overlay'); }
  });

  // Emoji picker
  document.getElementById('emoji-picker').addEventListener('click', e => {
    const btn = e.target.closest('.emoji-btn');
    if (btn) setEmoji(btn.dataset.emoji);
  });

  // Form submit
  document.getElementById('habit-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm()) return;

    const id       = document.getElementById('habit-id').value;
    const name     = document.getElementById('habit-name').value.trim();
    const category = document.getElementById('habit-category').value;
    const emoji    = document.getElementById('habit-emoji').value;
    const desc     = document.getElementById('habit-desc').value.trim();
    const goal     = document.getElementById('habit-goal').value;

    if (id) {
      await updateHabit(parseInt(id, 10), { name, category, emoji, desc, goal });
    } else {
      await addHabit(name, category, emoji, desc, goal);
    }
    closeModal('modal-overlay');
  });

  // Confirm delete
  document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
    if (!habitToDelete) return;
    await deleteHabit(habitToDelete);
    habitToDelete = null;
    closeModal('delete-overlay');
  });

  // Delegated: mark done / edit / delete buttons on cards
  document.getElementById('habit-grid').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = parseInt(btn.dataset.id, 10);

    if (action === 'mark-done') {
      markDone(id);
    } else if (action === 'edit') {
      openEditModal(id);
    } else if (action === 'delete') {
      openDeleteModal(id);
    }
  });

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('filter-tab--active'));
      tab.classList.add('filter-tab--active');
      activeFilter = tab.dataset.filter;
      renderHabitGrid();
    });
  });

  // Sort
  document.getElementById('sort-select').addEventListener('change', e => {
    sortMode = e.target.value;
    renderHabitGrid();
  });

  // Search
  document.getElementById('search-input').addEventListener('input', e => {
    searchQuery = e.target.value;
    renderHabitGrid();
  });

  // ── Calendar ──────────────────────────────────────────────
  document.getElementById('calendar-toggle-btn').addEventListener('click', toggleCalendar);
  document.getElementById('cal-prev-btn').addEventListener('click', prevMonth);
  document.getElementById('cal-next-btn').addEventListener('click', nextMonth);

  // Escape closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal('modal-overlay');
      closeModal('delete-overlay');
    }
  });
}

/* =============================================
   19. CALENDAR
   ============================================= */

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const calState = {
  year:    new Date().getFullYear(),
  month:   new Date().getMonth() + 1,  // 1-based
  data:    null,
  visible: false,
};

async function fetchCalendar(year, month) {
  const pad = n => String(n).padStart(2, '0');
  const res = await fetch(`${API_BASE}/api/calendar?month=${year}-${pad(month)}`);
  if (!res.ok) throw new Error('Calendar fetch failed');
  return res.json();
}

async function renderCalendar() {
  const { year, month } = calState;

  document.getElementById('cal-month-title').textContent =
    `${MONTH_NAMES[month - 1]} ${year}`;

  try {
    calState.data = await fetchCalendar(year, month);
  } catch {
    showToast('❌ Could not load calendar');
    return;
  }

  const { days, habits: allHabits } = calState.data;

  const habitMap = {};
  allHabits.forEach(h => { habitMap[h.habit_id] = h; });

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  const today      = todayISO();
  const firstDate  = new Date(`${year}-${String(month).padStart(2,'0')}-01T12:00:00`);
  const startDow   = firstDate.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  // Blank cells before day 1
  for (let i = 0; i < startDow; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-cell cal-cell--outside';
    grid.appendChild(blank);
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const iso      = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday  = iso === today;
    const isFuture = iso > today;
    const doneIds  = days[iso] || [];
    const hasLogs  = doneIds.length > 0;
    const total    = allHabits.length;
    const pct      = total > 0 ? Math.round((doneIds.length / total) * 100) : 0;

    const cell = document.createElement('div');
    cell.className = [
      'cal-cell',
      isToday  ? 'cal-cell--today'    : '',
      isFuture ? 'cal-cell--future'   : '',
      hasLogs  ? 'cal-cell--has-logs' : '',
    ].filter(Boolean).join(' ');
    cell.dataset.iso = iso;
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('tabindex', isFuture ? '-1' : '0');
    cell.setAttribute('aria-label', `${iso}${hasLogs ? ', ' + doneIds.length + ' habits done' : ''}`);

    // Ring circle
    const ring = document.createElement('div');
    ring.className = 'cal-day-ring';
    if (hasLogs && !isToday) ring.style.setProperty('--pct', pct);

    // Day number
    const numEl = document.createElement('span');
    numEl.className = 'cal-day-num';
    numEl.textContent = d;
    ring.appendChild(numEl);
    cell.appendChild(ring);

    // Click → select day and show detail panel
    if (!isFuture) {
      cell.addEventListener('click', () => selectDay(iso, cell, habitMap));
      cell.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectDay(iso, cell, habitMap);
        }
      });
    }

    grid.appendChild(cell);
  }

  // Staggered entrance index
  grid.querySelectorAll('.cal-cell:not(.cal-cell--outside)').forEach((c, i) => {
    c.style.setProperty('--i', i);
  });

  // Auto-select today (or the last day of the month if we've navigated away)
  const todayCell = grid.querySelector(`[data-iso="${today}"]`);
  const firstDoneCell = grid.querySelector('.cal-cell--has-logs');
  const autoCell = todayCell || firstDoneCell;
  if (autoCell) {
    selectDay(autoCell.dataset.iso, autoCell, habitMap);
  }
}

function selectDay(iso, cell, habitMap) {
  // Remove previous selection
  document.querySelectorAll('.cal-cell--selected').forEach(c => c.classList.remove('cal-cell--selected'));
  if (cell) cell.classList.add('cal-cell--selected');
  renderDayDetail(iso, habitMap);
}

function renderDayDetail(iso, habitMap) {
  const emptyEl   = document.getElementById('cal-detail-empty');
  const contentEl = document.getElementById('cal-detail-content');
  const dateEl    = document.getElementById('cal-detail-date');
  const statEl    = document.getElementById('cal-detail-stat');
  const barEl     = document.getElementById('cal-detail-bar');
  const listEl    = document.getElementById('cal-detail-list');

  const { days, habits: allHabits } = calState.data || { days: {}, habits: [] };
  const doneIds  = days[iso] || [];
  const doneSet  = new Set(doneIds);
  const total    = allHabits.length;
  const doneCount = allHabits.filter(h => doneSet.has(h.habit_id)).length;
  const pct      = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  // Format date nicely
  const d = new Date(iso + 'T12:00:00');
  const formatted = d.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  dateEl.textContent = formatted;
  statEl.textContent = total
    ? `${doneCount} of ${total} habit${total !== 1 ? 's' : ''} completed · ${pct}%`
    : 'No habits tracked yet';

  // Animate progress bar
  barEl.style.width = '0%';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    barEl.style.width = `${pct}%`;
    // Colour: green=100%, amber=partial, grey=0
    barEl.style.background = pct === 100
      ? 'var(--color-success)'
      : pct > 0 ? 'var(--color-accent)' : 'var(--color-border)';
  }));

  // Build habit list
  listEl.innerHTML = '';
  const done   = allHabits.filter(h =>  doneSet.has(h.habit_id));
  const missed = allHabits.filter(h => !doneSet.has(h.habit_id));

  if (!total) {
    listEl.innerHTML = '<p style="font-size:13px;color:var(--color-text-muted);padding:16px 0;text-align:center">No habits yet — add some!</p>';
  } else {
    [...done, ...missed].forEach((h, idx) => {
      const isDone = doneSet.has(h.habit_id);
      const row = document.createElement('div');
      row.className = `cal-detail__row cal-detail__row--${isDone ? 'done' : 'miss'}`;
      row.style.setProperty('--ri', idx);
      row.innerHTML = `
        <div class="cal-detail__row-icon">${iconEl(h.emoji, '', 20)}</div>
        <div class="cal-detail__row-info">
          <div class="cal-detail__row-name">${escapeHtml(h.title)}</div>
          <div class="cal-detail__row-cat">${escapeHtml(h.category)}</div>
        </div>
        <div class="cal-detail__row-status">
          ${isDone
            ? '<iconify-icon icon="ph:check-circle-fill" width="20"></iconify-icon>'
            : '<iconify-icon icon="ph:x-circle" width="20"></iconify-icon>'}
        </div>`;
      listEl.appendChild(row);
    });
  }

  emptyEl.hidden   = true;
  contentEl.hidden = false;
}

function toggleCalendar() {
  const layout = document.getElementById('cal-layout');
  const btn    = document.getElementById('calendar-toggle-btn');

  if (calState.visible) {
    calState.visible = false;
    btn.classList.remove('active');
    layout.classList.add('is-closing');
    layout.addEventListener('animationend', () => {
      layout.hidden = true;
      layout.classList.remove('is-closing');
    }, { once: true });
  } else {
    calState.visible = true;
    btn.classList.add('active');
    layout.hidden = false;
    renderCalendar();
  }
}

/* =============================================
   20. INIT
   ============================================= */

function prevMonth() {
  if (calState.month === 1) { calState.year--; calState.month = 12; }
  else { calState.month--; }
  renderCalendar();
}

function nextMonth() {
  const now = new Date();
  if (calState.year === now.getFullYear() && calState.month === now.getMonth() + 1) return;
  if (calState.month === 12) { calState.year++; calState.month = 1; }
  else { calState.month++; }
  renderCalendar();
}

async function init() {

  loadTheme();
  renderGreeting();
  initEvents();
  habits = await loadHabits();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);