import sqlite3

def init_db():
    """
    Creates the SQLite database and all required tables.
    Run this ONCE before starting the Flask app:  python database.py
    """
    conn = sqlite3.connect('momentum.db')
    cursor = conn.cursor()

    # ── Habits table ─────────────────────────────────────────────────────────
    # ✅ FIX: Added category, emoji, description, best_streak columns
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS Habits (
            habit_id      INTEGER PRIMARY KEY AUTOINCREMENT,
            title         TEXT    NOT NULL,
            category      TEXT    NOT NULL DEFAULT 'health',
            emoji         TEXT    NOT NULL DEFAULT '⭐',
            description   TEXT    DEFAULT '',
            goal          TEXT    NOT NULL DEFAULT 'once',
            current_streak INTEGER DEFAULT 0,
            best_streak    INTEGER DEFAULT 0,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # ── Habit_Logs table ─────────────────────────────────────────────────────
    # One row per habit per day — UNIQUE constraint prevents duplicate logs
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS Habit_Logs (
            log_id         INTEGER PRIMARY KEY AUTOINCREMENT,
            habit_id       INTEGER NOT NULL,
            completed_date DATE    NOT NULL,
            FOREIGN KEY (habit_id) REFERENCES Habits(habit_id) ON DELETE CASCADE,
            UNIQUE(habit_id, completed_date)
        )
    ''')

    # ── Seed data (only if empty) ────────────────────────────────────────────
    cursor.execute("SELECT COUNT(*) FROM Habits")
    if cursor.fetchone()[0] == 0:
        sample_habits = [
            ("Morning run",      "health",       "🏃", "Start the day with movement.", "once"),
            ("Read 30 minutes",  "learning",     "📖", "Fiction, non-fiction — anything.", "once"),
            ("Deep work block",  "productivity", "🎯", "No notifications. 90 min focus.",  "once"),
            ("10-min meditation","mindfulness",  "🧘", "", "once"),
        ]
        cursor.executemany(
            "INSERT INTO Habits (title, category, emoji, description, goal) VALUES (?, ?, ?, ?, ?)",
            sample_habits
        )
        print("✅ Inserted sample habits.")

    conn.commit()
    conn.close()
    print("✅ Database initialized: momentum.db")

if __name__ == '__main__':
    init_db()