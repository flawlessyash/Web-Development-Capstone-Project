# ◆ Streakr — Habit Streak Tracker

> Capstone Project | Web Development Course | Rishihood University | Semester 1

A full-stack habit tracking web application where users can create habits, mark them done daily, and build streaks over time.

---


## 🔗 Live Links

| | URL |
|---|---|
| Frontend | _Coming soon — Vercel_ |
| Backend / API | _Coming soon — Supabase_ |
| Custom Domain | _Coming soon_ |

---

## 📌 Project Plan

### Idea
A habit tracker where users can:
- Add daily habits (reading, exercise, meditation, etc.)
- Mark habits as done each day
- Track their current streak and best streak
- Filter habits by category and search by name
- See a 7-day history of each habit at a glance

### Why this idea?
Habit tracking is a real, everyday problem. The app demonstrates all required full-stack concepts — CRUD, search, filter, data validation, and API integration — while being small enough to finish in the deadline.

---

## 🗺️ Project Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER (Browser)                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND  (HTML · CSS · JS)                  │
│                                                                 │
│   Dashboard ──────────────────────────────────────────────      │
│      │              │                    │                      │
│   Add Habit     Mark Done           Edit / Delete               │
│   (modal +      (streak             (confirm                    │
│   validation)    recalc)             modal)                     │
│      │              │                    │                      │
│      └──────────────┴────────────────────┘                      │
│                          │                                      │
│              Supabase JS client call                            │
│      .from('habits').select() / insert() / update() / delete()  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE (Backend-as-a-Service)              │
│                                                                 │
│   Auto REST API (PostgREST)                                     │
│      │                  │                   │                   │
│   Auth (JWT)     Row Level Security     Realtime (optional)     │
│                  user_id = auth.uid()                           │
│                          │                                      │
│              Edge Functions (optional)                          │
│              custom streak logic · cron reset                   │
└────────────────────────────┬────────────────────────────────────┘
                             │ SQL query
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    POSTGRESQL (via Supabase)                    │
│                                                                 │
│   habits table                  completions table               │
│   ─────────────────             ──────────────────              │
│   id          uuid PK           id           uuid PK            │
│   user_id     uuid FK           habit_id     uuid FK            │
│   name        text              user_id      uuid FK            │
│   category    text              completed_at date               │
│   streak      integer                                           │
│   best_streak integer                                           │
│   created_at  timestamptz                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | HTML5, CSS3 | Structure and styling |
| Frontend | Vanilla JavaScript | Logic, DOM manipulation |
| Database & Backend | Supabase | Auth, REST API, PostgreSQL |
| Hosting (Frontend) | Vercel | Live frontend deployment |
| Hosting (Backend) | Supabase (built-in) | Auto-hosted API + DB |
| Domain | Custom domain | Linked to Vercel frontend |
| Version Control | Git + GitHub | Code tracking and collaboration |

---

## 📁 Folder Structure

```
streakr/
├── index.html          ← Main page (semantic HTML5)
├── style.css           ← All styles (responsive, dark theme)
├── app.js              ← Frontend JS (CRUD, streak logic, filter, search)
├── supabase.js         ← Supabase client setup + API helpers
├── README.md           ← This file
└── screenshots/
    └── dashboard.png   ← UI screenshot (add after building)
```

---

## ✅ Features Checklist

### Step 1 — Frontend UI
- [x] Semantic HTML5 (`header`, `main`, `section`, `article`, `nav`)
- [x] Responsive CSS — works on mobile and desktop
- [x] Habit cards with category badges and streak count
- [x] Stats bar (total habits, completed today, best streak, rate)
- [x] Add / Edit habit modal with form
- [x] Delete confirmation modal
- [x] Toast notifications
- [x] Dark theme with amber accent

### Step 2 — Frontend JS Logic
- [x] Add / Edit / Delete habits
- [x] Mark habit as done today
- [x] Streak calculation (consecutive days)
- [x] Best streak tracking
- [x] 7-day history dots per habit
- [x] Filter by category (All, Health, Learning, Productivity, Mindfulness)
- [x] Search habits by name
- [x] Form validation with error messages
- [x] localStorage (temporary, replaced by Supabase in Step 3)

### Step 3 — Database & Backend (Supabase)
- [ ] Supabase project setup
- [ ] `habits` table with proper schema
- [ ] `completions` table for streak history
- [ ] Row Level Security (RLS) policies
- [ ] Supabase JS client connected to frontend
- [ ] Replace localStorage with Supabase calls
- [ ] API latency checked in Supabase dashboard

### Step 4 — Full Stack Integration
- [ ] All CRUD operations working end-to-end
- [ ] Data validation on both frontend and database level
- [ ] Search and filter working with real DB data
- [ ] Frontend deployed to Vercel
- [ ] Supabase backend live
- [ ] Custom domain linked to frontend

---

## 🗄️ Database Schema (SQL)

```sql
-- habits table
create table habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  name        text not null,
  category    text check (category in ('health','learning','productivity','mindfulness')),
  description text,
  goal        text default 'once',
  streak      integer default 0,
  best_streak integer default 0,
  created_at  timestamptz default now()
);

-- completions table (one row per habit per day completed)
create table completions (
  id           uuid primary key default gen_random_uuid(),
  habit_id     uuid references habits on delete cascade not null,
  user_id      uuid references auth.users not null,
  completed_at date default current_date,
  unique(habit_id, completed_at)  -- prevent duplicate completions per day
);

-- Row Level Security
alter table habits      enable row level security;
alter table completions enable row level security;

-- Policies: users can only access their own data
create policy "habits: own rows only"
  on habits for all using (auth.uid() = user_id);

create policy "completions: own rows only"
  on completions for all using (auth.uid() = user_id);
```

---

## 🔌 API Reference (Supabase auto-generated)

| Operation | Supabase JS call |
|-----------|-----------------|
| Get all habits | `supabase.from('habits').select('*')` |
| Add a habit | `supabase.from('habits').insert({ name, category })` |
| Update a habit | `supabase.from('habits').update({ name }).eq('id', id)` |
| Delete a habit | `supabase.from('habits').delete().eq('id', id)` |
| Mark done today | `supabase.from('completions').insert({ habit_id, completed_at })` |
| Get completions | `supabase.from('completions').select('*').eq('habit_id', id)` |

---

## 🚀 How to Run Locally

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/streakr.git
cd streakr

# 2. Open in browser (no build step needed)
open index.html
# or just double-click index.html in your file manager

# 3. To connect Supabase (Step 3):
#    - Create a project at https://supabase.com
#    - Copy your project URL and anon key
#    - Add them to supabase.js
```

---

## 📅 Timeline

| Date | Milestone |
|------|-----------|
| 7–8 April | GitHub repo created ✅ |
| 24 April | Project plan + README pushed ✅ |
| 24–26 April | Backend (Supabase) integration |
| 27 April | Final commit (deadline 11:59pm) |
| Presentation day | VIVA |

---

## 🤝 Contribution

Both contributors push code via terminal. No drag-and-drop to GitHub.

```bash
# Daily workflow
git pull origin main          # always pull before starting
# ... write code ...
git add .
git commit -m "feat: add streak reset logic"
git push origin main
```

If you get a merge conflict:
```bash
git pull origin main          # fetch latest
# fix the conflict in your editor
git add .
git commit -m "fix: resolve merge conflict in app.js"
git push origin main
```

---

## 📸 Screenshots

> _Add screenshots here after UI is complete_

---

*Built with ◆ for Rishihood University Web Dev Capstone — April 2026*