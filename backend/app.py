import os
import psycopg2
import psycopg2.extras
import psycopg2.errors
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from datetime import date, timedelta
from dotenv import load_dotenv

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR     = os.path.dirname(os.path.abspath(__file__))   # .../backend/
FRONTEND_DIR = os.path.join(BASE_DIR, '..', 'frontend')     # .../frontend/

# Load .env from the backend directory (works regardless of where you run from)
load_dotenv(os.path.join(BASE_DIR, '.env'))

app = Flask(
    __name__,
    template_folder=os.path.join(FRONTEND_DIR, 'templates'),
    static_folder=os.path.join(FRONTEND_DIR, 'static'),
)

# Allow cross-origin requests from GitHub Pages (and localhost for dev)
CORS(app, resources={r"/api/*": {"origins": [
    "http://localhost:*",
    "http://127.0.0.1:*",
    "https://flawlessyash.github.io",
]}})


# ── DB helper ─────────────────────────────────────────────────────────────────

def get_db_connection():
    """Open a psycopg2 connection to Supabase PostgreSQL.
    Uses individual DB_* env vars to avoid URL-encoding issues."""
    return psycopg2.connect(
        host=os.environ['DB_HOST'],
        port=int(os.environ.get('DB_PORT', 5432)),
        dbname=os.environ['DB_NAME'],
        user=os.environ['DB_USER'],
        password=os.environ['DB_PASSWORD'],
        sslmode=os.environ.get('DB_SSLMODE', 'require'),
        cursor_factory=psycopg2.extras.RealDictCursor,
        connect_timeout=10,
    )


# ── Frontend ──────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


# ── GET /api/habits ───────────────────────────────────────────────────────────

@app.route('/api/habits', methods=['GET'])
def get_habits():
    conn  = get_db_connection()
    cur   = conn.cursor()
    today = date.today().isoformat()

    cur.execute('''
        SELECT
            h.habit_id,
            h.title,
            h.category,
            h.emoji,
            h.description,
            h.goal,
            h.current_streak,
            h.best_streak,
            h.created_at,
            CASE WHEN hl.log_id IS NOT NULL THEN 1 ELSE 0 END AS logged_today
        FROM habits h
        LEFT JOIN habit_logs hl
            ON h.habit_id = hl.habit_id AND hl.completed_date = %s
        ORDER BY h.created_at DESC
    ''', (today,))
    habits = cur.fetchall()

    habits_list = []
    seven_days_ago = (date.today() - timedelta(days=6)).isoformat()

    for row in habits:
        h = dict(row)
        # Convert timestamptz → plain string so JSON can serialise it
        if h.get('created_at'):
            h['created_at'] = h['created_at'].isoformat()

        cur.execute('''
            SELECT completed_date FROM habit_logs
            WHERE habit_id = %s AND completed_date >= %s
            ORDER BY completed_date ASC
        ''', (h['habit_id'], seven_days_ago))
        logs = cur.fetchall()
        h['history'] = [str(r['completed_date']) for r in logs]
        habits_list.append(h)

    cur.close()
    conn.close()
    return jsonify(habits_list)


# ── POST /api/habits ──────────────────────────────────────────────────────────

@app.route('/api/habits', methods=['POST'])
def add_habit():
    data = request.get_json()
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400
    if len(title) < 2:
        return jsonify({"error": "Title must be at least 2 characters"}), 400

    category    = data.get('category',    'health')
    emoji       = data.get('emoji',       '⭐')
    description = (data.get('description') or '').strip()
    goal        = data.get('goal',        'once')

    valid_categories = ['health', 'learning', 'productivity', 'mindfulness']
    if category not in valid_categories:
        return jsonify({"error": "Invalid category"}), 400

    conn = get_db_connection()
    cur  = conn.cursor()
    cur.execute(
        '''INSERT INTO habits (title, category, emoji, description, goal)
           VALUES (%s, %s, %s, %s, %s)
           RETURNING habit_id''',
        (title, category, emoji, description, goal)
    )
    habit_id = cur.fetchone()['habit_id']
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({
        "habit_id":       habit_id,
        "title":          title,
        "category":       category,
        "emoji":          emoji,
        "description":    description,
        "goal":           goal,
        "current_streak": 0,
        "best_streak":    0,
        "logged_today":   0,
        "history":        []
    }), 201


# ── PUT /api/habits/<id> ──────────────────────────────────────────────────────

@app.route('/api/habits/<int:habit_id>', methods=['PUT'])
def update_habit(habit_id):
    data = request.get_json()
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400
    if len(title) < 2:
        return jsonify({"error": "Title must be at least 2 characters"}), 400

    category    = data.get('category',    'health')
    emoji       = data.get('emoji',       '⭐')
    description = (data.get('description') or '').strip()
    goal        = data.get('goal',        'once')

    valid_categories = ['health', 'learning', 'productivity', 'mindfulness']
    if category not in valid_categories:
        return jsonify({"error": "Invalid category"}), 400

    conn = get_db_connection()
    cur  = conn.cursor()

    cur.execute('SELECT habit_id FROM habits WHERE habit_id = %s', (habit_id,))
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({"error": "Habit not found"}), 404

    cur.execute(
        '''UPDATE habits
           SET title = %s, category = %s, emoji = %s, description = %s, goal = %s
           WHERE habit_id = %s''',
        (title, category, emoji, description, goal, habit_id)
    )
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"message": "Habit updated successfully"}), 200


# ── DELETE /api/habits/<id> ───────────────────────────────────────────────────

@app.route('/api/habits/<int:habit_id>', methods=['DELETE'])
def delete_habit(habit_id):
    conn = get_db_connection()
    cur  = conn.cursor()

    cur.execute('SELECT habit_id FROM habits WHERE habit_id = %s', (habit_id,))
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({"error": "Habit not found"}), 404

    # ON DELETE CASCADE in schema removes related habit_logs rows automatically
    cur.execute('DELETE FROM habits WHERE habit_id = %s', (habit_id,))
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"message": "Habit deleted successfully"}), 200


# ── POST /api/habits/<id>/log ─────────────────────────────────────────────────

@app.route('/api/habits/<int:habit_id>/log', methods=['POST'])
def log_habit(habit_id):
    today     = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    conn = get_db_connection()
    cur  = conn.cursor()

    cur.execute('SELECT * FROM habits WHERE habit_id = %s', (habit_id,))
    habit = cur.fetchone()
    if not habit:
        cur.close()
        conn.close()
        return jsonify({"error": "Habit not found"}), 404

    try:
        # Unique constraint raises UniqueViolation if already logged today
        cur.execute(
            'INSERT INTO habit_logs (habit_id, completed_date) VALUES (%s, %s)',
            (habit_id, today)
        )

        # Streak logic: continue if last log was yesterday, else reset to 1
        cur.execute(
            '''SELECT completed_date FROM habit_logs
               WHERE habit_id = %s AND completed_date < %s
               ORDER BY completed_date DESC LIMIT 1''',
            (habit_id, today)
        )
        last_log = cur.fetchone()

        if last_log and str(last_log['completed_date']) == yesterday:
            new_streak = habit['current_streak'] + 1
        else:
            new_streak = 1

        new_best = max(new_streak, habit['best_streak'])

        cur.execute(
            '''UPDATE habits
               SET current_streak = %s, best_streak = %s
               WHERE habit_id = %s''',
            (new_streak, new_best, habit_id)
        )

        conn.commit()
        return jsonify({
            "message":        "Habit logged successfully",
            "current_streak": new_streak,
            "best_streak":    new_best
        }), 200

    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        return jsonify({"error": "Habit already logged for today"}), 400

    finally:
        cur.close()
        conn.close()


# ── GET /api/calendar?month=YYYY-MM ──────────────────────────────────────────

@app.route('/api/calendar', methods=['GET'])
def get_calendar():
    month_str = request.args.get('month', date.today().strftime('%Y-%m'))
    try:
        year  = int(month_str[:4])
        month = int(month_str[5:7])
        if not (1 <= month <= 12):
            raise ValueError
    except (ValueError, IndexError):
        return jsonify({"error": "Invalid month format. Use YYYY-MM"}), 400

    first_day = date(year, month, 1)
    if month == 12:
        last_day = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        last_day = date(year, month + 1, 1) - timedelta(days=1)

    conn = get_db_connection()
    cur  = conn.cursor()

    cur.execute(
        'SELECT habit_id, title, emoji, category FROM habits ORDER BY created_at ASC'
    )
    habits_list = [dict(h) for h in cur.fetchall()]

    cur.execute(
        '''SELECT habit_id, completed_date
           FROM habit_logs
           WHERE completed_date >= %s AND completed_date <= %s
           ORDER BY completed_date ASC''',
        (first_day.isoformat(), last_day.isoformat())
    )
    logs = cur.fetchall()
    cur.close()
    conn.close()

    days = {}
    for log in logs:
        d = str(log['completed_date'])
        if d not in days:
            days[d] = []
        days[d].append(log['habit_id'])

    return jsonify({"year": year, "month": month, "days": days, "habits": habits_list})


# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    app.run(debug=True, port=5000)