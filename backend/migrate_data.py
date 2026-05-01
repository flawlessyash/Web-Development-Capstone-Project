"""
migrate_data.py
───────────────
One-time script: copies all data from your local SQLite (momentum.db)
to your Supabase PostgreSQL database.

Run AFTER:
  1. Filling in DATABASE_URL in .env
  2. Running `python database.py` to create the tables on Supabase

Usage:
  python migrate_data.py
"""

import os
import sqlite3
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

SQLITE_PATH = "momentum.db"


def migrate():
    # ── Connect to both databases ─────────────────────────────────────────────
    if not os.path.exists(SQLITE_PATH):
        print(f"❌ SQLite file '{SQLITE_PATH}' not found. Nothing to migrate.")
        return

    required = ('DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD')
    missing  = [v for v in required if not os.environ.get(v)]
    if missing:
        print(f"❌ Missing env vars: {', '.join(missing)}. Check your .env file.")
        return

    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cur  = sqlite_conn.cursor()

    pg_conn = psycopg2.connect(
        host=os.environ['DB_HOST'],
        port=int(os.environ.get('DB_PORT', 5432)),
        dbname=os.environ['DB_NAME'],
        user=os.environ['DB_USER'],
        password=os.environ['DB_PASSWORD'],
        sslmode=os.environ.get('DB_SSLMODE', 'require'),
        cursor_factory=psycopg2.extras.RealDictCursor,
        connect_timeout=10,
    )
    pg_cur = pg_conn.cursor()


    # ── Migrate habits ────────────────────────────────────────────────────────
    sqlite_cur.execute("SELECT * FROM Habits ORDER BY habit_id ASC")
    habits = sqlite_cur.fetchall()

    if not habits:
        print("⚠️  No habits found in SQLite. Nothing to migrate.")
    else:
        print(f"Migrating {len(habits)} habit(s)...")
        for h in habits:
            pg_cur.execute(
                """INSERT INTO habits
                       (habit_id, title, category, emoji, description, goal,
                        current_streak, best_streak, created_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (habit_id) DO NOTHING""",
                (
                    h["habit_id"], h["title"], h["category"], h["emoji"],
                    h["description"] or '', h["goal"],
                    h["current_streak"], h["best_streak"],
                    h["created_at"]
                )
            )
        print(f"  ✅ Habits migrated.")

    # ── Migrate habit_logs ────────────────────────────────────────────────────
    sqlite_cur.execute("SELECT * FROM Habit_Logs ORDER BY log_id ASC")
    logs = sqlite_cur.fetchall()

    if logs:
        print(f"Migrating {len(logs)} log entry/entries...")
        for log in logs:
            pg_cur.execute(
                """INSERT INTO habit_logs (log_id, habit_id, completed_date)
                   VALUES (%s, %s, %s)
                   ON CONFLICT DO NOTHING""",
                (log["log_id"], log["habit_id"], log["completed_date"])
            )
        print(f"  ✅ Logs migrated.")

    # ── Sync PostgreSQL sequences so future INSERTs use correct IDs ───────────
    pg_cur.execute("""
        SELECT setval('habits_habit_id_seq',
               COALESCE((SELECT MAX(habit_id) FROM habits), 0) + 1, false)
    """)
    pg_cur.execute("""
        SELECT setval('habit_logs_log_id_seq',
               COALESCE((SELECT MAX(log_id) FROM habit_logs), 0) + 1, false)
    """)

    pg_conn.commit()

    # ── Cleanup ───────────────────────────────────────────────────────────────
    sqlite_cur.close()
    sqlite_conn.close()
    pg_cur.close()
    pg_conn.close()

    print("\n🎉 Migration complete! Your Supabase database is ready.")


if __name__ == '__main__':
    migrate()
