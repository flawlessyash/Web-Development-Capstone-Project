/**
 * STREAKR — Habit Tracker
 * app.js  |  Step 1: Frontend Feature Development (JS Logic)
 *
 * Architecture:
 *  - State lives in localStorage (will be replaced by API calls in Step 3)
 *  - All DOM manipulation is centralized in render functions
 *  - Functions are small, named clearly — easy to defend in VIVA
 */

'use strict';

/* =============================================
   1. CONSTANTS & STATE
   ============================================= */

const STORAGE_KEY = 'streakr_habits';

/** @type {Habit[]} */
let habits = loadHabits();

let activeFilter = 'all';
let searchQuery  = '';
let habitToDelete = null;   // ID of habit pending deletion

/**
 * @typedef {Object} Habit
 * @property {string}  id         - Unique identifier (timestamp string)
 * @property {string}  name       - Habit name
 * @property {string}  category   - health | learning | productivity | mindfulness
 * @property {string}  desc       - Optional description
 * @property {string}  goal       - once | twice | custom
 * @property {number}  streak     - Current consecutive-day streak
 * @property {number}  bestStreak - Best streak ever
 * @property {string[]} history   - ISO date strings when habit was completed
 * @property {string}  createdAt  - ISO date string
 */

/* =============================================
   2. PERSISTENCE (localStorage — replaced by API in Step 3)
   ============================================= */

function loadHabits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : getSampleHabits();
  } catch {
    return getSampleHabits();
  }
}

function saveHabits() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
}

/** Starter habits so the app doesn't look empty on first load */
function getSampleHabits() {
  return [
    createHabit('Morning run',        'health',       'Start the day moving — even 20 min counts.', 'once'),
    createHabit('Read 30 minutes',    'learning',     'Fiction, non-fiction — anything counts.',    'once'),
    createHabit('Deep work block',    'productivity', 'No notifications. Focus for 90 minutes.',    'once'),
    createHabit('10-min meditation',  'mindfulness',  '',                                           'once'),
  ];
}

/* =============================================
   3. HABIT CRUD
   ============================================= */

function createHabit(name, category, desc, goal) {
  const today = todayISO();
  return {
    id:         Date.now().toString() + Math.random().toString(36).slice(2, 6),
    name:       name.trim(),
    category,
    desc:       desc.trim(),
    goal,
    streak:     0,
    bestStreak: 0,
    history:    [],
    createdAt:  today,
  };
}

function addHabit(name, category, desc, goal) {
  const habit = createHabit(name, category, desc, goal);
  habits.unshift(habit);   // newest first
  saveHabits();
  return habit;
}

function updateHabit(id, updates) {
  habits = habits.map(h => h.id === id ? { ...h, ...updates } : h);
  saveHabits();
}

function deleteHabit(id) {
  habits = habits.filter(h => h.id !== id);
  saveHabits();
}

/**
 * Mark a habit as done today and recalculate streak.
 * @param {string} id
 */
function markDone(id) {
  const habit = habits.find(h => h.id === id);
  if (!habit || isDoneToday(habit)) return;

  const today     = todayISO();
  const yesterday = offsetDate(-1);

  // Add today to history
  const updatedHistory = [...habit.history, today];

  // Recalculate streak
  const lastEntry = habit.history.at(-1);
  let newStreak   = lastEntry === yesterday ? habit.streak + 1 : 1;
  let bestStreak  = Math.max(newStreak, habit.bestStreak);

  updateHabit(id, {
    history:    updatedHistory,
    streak:     newStreak,
    bestStreak: bestStreak,
  });
}

/* =============================================
   4. DATE HELPERS
   ============================================= */

/** Returns today's date as YYYY-MM-DD */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Returns a date offset from today as YYYY-MM-DD */
function offsetDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Check if a habit was completed today */
function isDoneToday(habit) {
  return habit.history.includes(todayISO());
}

/**
 * Returns array of last N days as ISO strings (most recent last)
 * @param {number} n
 * @returns {string[]}
 */
function lastNDays(n) {
  return Array.from({ length: n }, (_, i) => offsetDate(i - n + 1));
}

/* =============================================
   5. FILTERING & SEARCH
   ============================================= */

function getFilteredHabits() {
  return habits.filter(h => {
    const matchesFilter = activeFilter === 'all' || h.category === activeFilter;
    const matchesSearch = h.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });
}

/* =============================================
   6. RENDER FUNCTIONS
   ============================================= */

function renderAll() {
  renderStats();
  renderHabitGrid();
}

function renderStats() {
  const total    = habits.length;
  const done     = habits.filter(isDoneToday).length;
  const best     = Math.max(0, ...habits.map(h => h.bestStreak));
  const rate     = total > 0 ? Math.round((done / total) * 100) : 0;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-done').textContent  = done;
  document.getElementById('stat-best').textContent  = best;
  document.getElementById('stat-rate').textContent  = rate + '%';
}

function renderHabitGrid() {
  const grid       = document.getElementById('habit-grid');
  const emptyState = document.getElementById('empty-state');
  const filtered   = getFilteredHabits();

  grid.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  filtered.forEach(habit => {
    const card = buildHabitCard(habit);
    grid.appendChild(card);
  });
}

/**
 * Build a single habit card DOM element
 * @param {Habit} habit
 * @returns {HTMLElement}
 */
function buildHabitCard(habit) {
  const done  = isDoneToday(habit);
  const days  = lastNDays(7);

  const card = document.createElement('article');
  card.className  = `habit-card${done ? ' habit-card--done' : ''}`;
  card.dataset.id = habit.id;
  card.dataset.category = habit.category;
  card.setAttribute('role', 'listitem');

  card.innerHTML = `
    <div class="habit-card__top">
      <div class="habit-card__info">
        <h3 class="habit-card__name" title="${escapeHtml(habit.name)}">${escapeHtml(habit.name)}</h3>
        <div class="habit-card__meta">
          <span class="category-badge category-badge--${habit.category}">${habit.category}</span>
        </div>
      </div>
      <div class="habit-card__actions">
        <button
          class="btn btn--icon"
          data-action="edit"
          data-id="${habit.id}"
          aria-label="Edit ${escapeHtml(habit.name)}"
          title="Edit">✎</button>
        <button
          class="btn btn--icon"
          data-action="delete"
          data-id="${habit.id}"
          aria-label="Delete ${escapeHtml(habit.name)}"
          title="Delete">✕</button>
      </div>
    </div>

    ${habit.desc ? `<p class="habit-card__desc">${escapeHtml(habit.desc)}</p>` : ''}

    <div class="habit-card__streak">
      <div class="streak-info">
        <span class="streak-count">${habit.streak}</span>
        <span class="streak-label">day streak</span>
      </div>
      <span class="streak-flame" aria-label="${done ? 'On fire' : 'Not done yet'}">${done ? '🔥' : '○'}</span>
    </div>

    <div class="habit-card__history" aria-label="Last 7 days">
      <span class="history-label">7d</span>
      ${days.map((day, i) => {
        const isToday   = i === days.length - 1;
        const completed = habit.history.includes(day);
        return `<div
          class="history-dot${completed ? ' history-dot--done' : ''}${isToday ? ' history-dot--today' : ''}"
          title="${day}${completed ? ' ✓' : ''}"
          aria-label="${day}${completed ? ' completed' : ''}"
        ></div>`;
      }).join('')}
    </div>

    <div class="habit-card__footer">
      <button
        class="mark-done-btn${done ? ' done' : ''}"
        data-action="mark-done"
        data-id="${habit.id}"
        ${done ? 'disabled aria-disabled="true"' : ''}
        aria-label="${done ? 'Already done today' : 'Mark as done today'}"
      >
        ${done ? '✓ Done today' : 'Mark as done'}
      </button>
    </div>
  `;

  return card;
}

/* =============================================
   7. MODAL LOGIC
   ============================================= */

function openAddModal() {
  document.getElementById('modal-title').textContent = 'Add Habit';
  document.getElementById('habit-id').value    = '';
  document.getElementById('habit-name').value  = '';
  document.getElementById('habit-category').value = 'health';
  document.getElementById('habit-desc').value  = '';
  document.getElementById('habit-goal').value  = 'once';
  clearFormErrors();
  showModal('modal-overlay');
  document.getElementById('habit-name').focus();
}

function openEditModal(id) {
  const habit = habits.find(h => h.id === id);
  if (!habit) return;

  document.getElementById('modal-title').textContent     = 'Edit Habit';
  document.getElementById('habit-id').value              = habit.id;
  document.getElementById('habit-name').value            = habit.name;
  document.getElementById('habit-category').value        = habit.category;
  document.getElementById('habit-desc').value            = habit.desc;
  document.getElementById('habit-goal').value            = habit.goal;
  clearFormErrors();
  showModal('modal-overlay');
  document.getElementById('habit-name').focus();
}

function openDeleteModal(id) {
  habitToDelete = id;
  showModal('delete-overlay');
}

const MODAL_IDS = ['modal-overlay', 'delete-overlay'];

function showModal(id) {
  // Close every other modal first — never stack two overlays
  MODAL_IDS.forEach(mid => {
    document.getElementById(mid).hidden = (mid !== id);
  });
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).hidden = true;
  // Only restore scroll when ALL modals are closed
  const anyOpen = MODAL_IDS.some(mid => !document.getElementById(mid).hidden);
  if (!anyOpen) document.body.style.overflow = '';
}

/* =============================================
   8. FORM VALIDATION
   ============================================= */

function validateHabitForm() {
  const name = document.getElementById('habit-name').value.trim();
  clearFormErrors();

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

function showFieldError(inputId, errorId, message) {
  document.getElementById(inputId).classList.add('form-input--error');
  document.getElementById(errorId).textContent = message;
}

function clearFormErrors() {
  document.querySelectorAll('.form-input--error')
    .forEach(el => el.classList.remove('form-input--error'));
  document.querySelectorAll('.form-error')
    .forEach(el => el.textContent = '');
}

/* =============================================
   9. TOAST
   ============================================= */

let toastTimer;

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('toast--show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('toast--show'), 2500);
}

/* =============================================
   10. UTILITIES
   ============================================= */

/** Escape HTML to prevent XSS */
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

/* =============================================
   11. EVENT LISTENERS
   ============================================= */

function initEventListeners() {
  // Open modal buttons
  document.getElementById('open-modal-btn').addEventListener('click', openAddModal);
  document.getElementById('empty-add-btn').addEventListener('click', openAddModal);

  // Close modal buttons
  document.getElementById('close-modal-btn').addEventListener('click',  () => closeModal('modal-overlay'));
  document.getElementById('cancel-modal-btn').addEventListener('click', () => closeModal('modal-overlay'));
  document.getElementById('cancel-delete-btn').addEventListener('click',() => closeModal('delete-overlay'));

  // Close on overlay click
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('modal-overlay');
  });
  document.getElementById('delete-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('delete-overlay');
  });

  // Keyboard: close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal('modal-overlay');
      closeModal('delete-overlay');
    }
  });

  // Form submit
  document.getElementById('habit-form').addEventListener('submit', e => {
    e.preventDefault();
    if (!validateHabitForm()) return;

    const id       = document.getElementById('habit-id').value;
    const name     = document.getElementById('habit-name').value.trim();
    const category = document.getElementById('habit-category').value;
    const desc     = document.getElementById('habit-desc').value.trim();
    const goal     = document.getElementById('habit-goal').value;

    if (id) {
      updateHabit(id, { name, category, desc, goal });
      showToast('Habit updated!');
    } else {
      addHabit(name, category, desc, goal);
      showToast('Habit added!');
    }

    closeModal('modal-overlay');
    renderAll();
  });

  // Confirm delete
  document.getElementById('confirm-delete-btn').addEventListener('click', () => {
    if (!habitToDelete) return;
    deleteHabit(habitToDelete);
    habitToDelete = null;
    closeModal('delete-overlay');
    showToast('Habit deleted.');
    renderAll();
  });

  // Delegated click on habit grid (edit, delete, mark-done)
  document.getElementById('habit-grid').addEventListener('click', e => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;

    const action = actionBtn.dataset.action;
    const id     = actionBtn.dataset.id;

    if (action === 'mark-done') {
      markDone(id);
      showToast('🔥 Streak updated!');
      renderAll();
    } else if (action === 'edit') {
      openEditModal(id);
    } else if (action === 'delete') {
      openDeleteModal(id);
    }
  });

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => {
        t.classList.remove('filter-tab--active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('filter-tab--active');
      tab.setAttribute('aria-selected', 'true');
      activeFilter = tab.dataset.filter;
      renderHabitGrid();
    });
  });

  // Search
  document.getElementById('search-input').addEventListener('input', e => {
    searchQuery = e.target.value;
    renderHabitGrid();
  });
}

/* =============================================
   12. DATE DISPLAY
   ============================================= */

function renderDate() {
  const el = document.getElementById('today-date');
  if (!el) return;
  el.textContent = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
    year:    'numeric',
  });
}

/* =============================================
   13. INIT
   ============================================= */

function init() {
  renderDate();
  initEventListeners();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);