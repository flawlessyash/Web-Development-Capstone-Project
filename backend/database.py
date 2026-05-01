import os
import psycopg2
from dotenv import load_dotenv

# Load .env from the backend directory regardless of where script is run from
_BASE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_BASE, '.env'))


def get_conn():
    """Connect to Supabase PostgreSQL using individual env vars.
    Avoids URL-encoding issues with special characters in passwords."""
    missing = [v for v in ('DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD') if not os.environ.get(v)]
    if missing:
        raise RuntimeError(f"Missing required env vars: {', '.join(missing)}. Check your .env file.")

    return psycopg2.connect(
        host=os.environ['DB_HOST'],
        port=int(os.environ.get('DB_PORT', 5432)),
        dbname=os.environ['DB_NAME'],
        user=os.environ['DB_USER'],
        password=os.environ['DB_PASSWORD'],
        sslmode=os.environ.get('DB_SSLMODE', 'require'),
        connect_timeout=10,
    )

def init_db():
    """
    Creates the PostgreSQL tables on Supabase and seeds sample data.
    Run once: python database.py
    """
    conn = get_conn()
    cur  = conn.cursor()

    # ── habits table ──────────────────────────────────────────────────────────
    cur.execute('''
        CREATE TABLE IF NOT EXISTS habits (
            habit_id       SERIAL PRIMARY KEY,
            title          TEXT    NOT NULL,
            category       TEXT    NOT NULL DEFAULT 'health',
            emoji          TEXT    NOT NULL DEFAULT '⭐',
            description    TEXT    DEFAULT '',
            goal           TEXT    NOT NULL DEFAULT 'once',
            current_streak INTEGER NOT NULL DEFAULT 0,
            best_streak    INTEGER NOT NULL DEFAULT 0,
            created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    ''')

    # ── habit_logs table ──────────────────────────────────────────────────────
    cur.execute('''
        CREATE TABLE IF NOT EXISTS habit_logs (
            log_id         SERIAL PRIMARY KEY,
            habit_id       INTEGER NOT NULL REFERENCES habits(habit_id) ON DELETE CASCADE,
            completed_date DATE    NOT NULL,
            UNIQUE (habit_id, completed_date)
        )
    ''')

    # ── seed sample data (only if table is empty) ─────────────────────────────
    cur.execute("SELECT COUNT(*) FROM habits")
    if cur.fetchone()[0] == 0:
        sample_habits = [
            ("Morning run",       "health",       "ph:person-simple-run-bold", "Start the day with movement.",      "once"),
            ("Read 30 minutes",   "learning",     "ph:book-open-bold",         "Fiction, non-fiction — anything.",  "once"),
            ("Deep work block",   "productivity", "ph:target-bold",            "No notifications. 90 min focus.",   "once"),
            ("10-min meditation", "mindfulness",  "ph:person-simple-bold",     "",                                  "once"),
        ]
        cur.executemany(
            """INSERT INTO habits (title, category, emoji, description, goal)
               VALUES (%s, %s, %s, %s, %s)""",
            sample_habits
        )
        print("✅ Inserted sample habits.")

    conn.commit()
    cur.close()
    conn.close()
    print("✅ Supabase database initialised.")


if __name__ == '__main__':
    init_db()