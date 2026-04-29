from flask import Flask, render_template, request, jsonify
import sqlite3
from datetime import datetime, date, timedelta

app = Flask(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# DB HELPER
# ─────────────────────────────────────────────────────────────────────────────

def get_db_connection():
    conn = sqlite3.connect('momentum.db')
    conn.row_factory = sqlite3.Row          # access columns by name
    conn.execute("PRAGMA foreign_keys = ON") # enforce FK ON DELETE CASCADE
    return conn

# ─────────────────────────────────────────────────────────────────────────────
# FRONTEND ROUTE
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')

# ─────────────────────────────────────────────────────────────────────────────
# GET  /api/habits  — fetch all habits with today's log status + 7-day history
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/api/habits', methods=['GET'])
def get_habits():
    conn  = get_db_connection()
    today = date.today().isoformat()

    # Fetch all habits with a flag for whether they are logged today
    query = '''
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
        FROM Habits h
        LEFT JOIN Habit_Logs hl
            ON h.habit_id = hl.habit_id AND hl.completed_date = ?
        ORDER BY h.created_at DESC
    '''
    habits = conn.execute(query, (today,)).fetchall()

    habits_list = []
    for row in habits:
        h = dict(row)

        # Build last-7-days history array: ["2026-04-19", "2026-04-21", ...]
        seven_days_ago = (date.today() - timedelta(days=6)).isoformat()
        logs = conn.execute(
            '''SELECT completed_date FROM Habit_Logs
               WHERE habit_id = ? AND completed_date >= ?
               ORDER BY completed_date ASC''',
            (h['habit_id'], seven_days_ago)
        ).fetchall()
        h['history'] = [r['completed_date'] for r in logs]

        habits_list.append(h)

    conn.close()
    return jsonify(habits_list)

# ─────────────────────────────────────────────────────────────────────────────
# POST /api/habits  — create a new habit
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/api/habits', methods=['POST'])
def add_habit():
    data = request.get_json()

    # ✅ Validation
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400
    if len(title) < 2:
        return jsonify({"error": "Title must be at least 2 characters"}), 400

    category    = data.get('category',    'health')
    emoji       = data.get('emoji',       '⭐')
    description = (data.get('description') or '').strip()
    goal        = data.get('goal',        'once')

    # Whitelist category values
    valid_categories = ['health', 'learning', 'productivity', 'mindfulness']
    if category not in valid_categories:
        return jsonify({"error": "Invalid category"}), 400

    conn   = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        '''INSERT INTO Habits (title, category, emoji, description, goal)
           VALUES (?, ?, ?, ?, ?)''',
        (title, category, emoji, description, goal)
    )
    habit_id = cursor.lastrowid
    conn.commit()
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

# ─────────────────────────────────────────────────────────────────────────────
# PUT  /api/habits/<id>  — update an existing habit  ✅ NEW ROUTE
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/api/habits/<int:habit_id>', methods=['PUT'])
def update_habit(habit_id):
    data = request.get_json()

    # ✅ Validation
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

    # Check habit exists
    existing = conn.execute(
        'SELECT habit_id FROM Habits WHERE habit_id = ?', (habit_id,)
    ).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Habit not found"}), 404

    conn.execute(
        '''UPDATE Habits
           SET title = ?, category = ?, emoji = ?, description = ?, goal = ?
           WHERE habit_id = ?''',
        (title, category, emoji, description, goal, habit_id)
    )
    conn.commit()
    conn.close()

    return jsonify({"message": "Habit updated successfully"}), 200

# ─────────────────────────────────────────────────────────────────────────────
# DELETE /api/habits/<id>  — delete a habit  ✅ NEW ROUTE
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/api/habits/<int:habit_id>', methods=['DELETE'])
def delete_habit(habit_id):
    conn = get_db_connection()

    # Check habit exists
    existing = conn.execute(
        'SELECT habit_id FROM Habits WHERE habit_id = ?', (habit_id,)
    ).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Habit not found"}), 404

    # ON DELETE CASCADE in schema will also delete related Habit_Logs rows
    conn.execute('DELETE FROM Habits WHERE habit_id = ?', (habit_id,))
    conn.commit()
    conn.close()

    return jsonify({"message": "Habit deleted successfully"}), 200

# ─────────────────────────────────────────────────────────────────────────────
# POST /api/habits/<id>/log  — mark habit as done today
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/api/habits/<int:habit_id>/log', methods=['POST'])
def log_habit(habit_id):
    today     = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    conn   = get_db_connection()
    cursor = conn.cursor()

    # Check habit exists
    habit = cursor.execute(
        'SELECT * FROM Habits WHERE habit_id = ?', (habit_id,)
    ).fetchone()
    if not habit:
        conn.close()
        return jsonify({"error": "Habit not found"}), 404

    try:
        # Insert today's log — UNIQUE constraint raises IntegrityError if duplicate
        cursor.execute(
            'INSERT INTO Habit_Logs (habit_id, completed_date) VALUES (?, ?)',
            (habit_id, today)
        )

        # ✅ Correct streak logic:
        # If last log was yesterday → continue streak, else reset to 1
        last_log = cursor.execute(
            '''SELECT completed_date FROM Habit_Logs
               WHERE habit_id = ? AND completed_date < ?
               ORDER BY completed_date DESC LIMIT 1''',
            (habit_id, today)
        ).fetchone()

        if last_log and last_log['completed_date'] == yesterday:
            new_streak = habit['current_streak'] + 1
        else:
            new_streak = 1

        # Update best_streak if current is higher
        new_best = max(new_streak, habit['best_streak'])

        cursor.execute(
            '''UPDATE Habits
               SET current_streak = ?, best_streak = ?
               WHERE habit_id = ?''',
            (new_streak, new_best, habit_id)
        )

        conn.commit()
        return jsonify({
            "message":        "Habit logged successfully",
            "current_streak": new_streak,
            "best_streak":    new_best
        }), 200

    except sqlite3.IntegrityError:
        conn.rollback()
        return jsonify({"error": "Habit already logged for today"}), 400

    finally:
        conn.close()

# ─────────────────────────────────────────────────────────────────────────────
# GET /api/calendar?month=YYYY-MM  — completions grouped by date for a month
# ─────────────────────────────────────────────────────────────────────────────

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

    habits_rows = conn.execute(
        'SELECT habit_id, title, emoji, category FROM Habits ORDER BY created_at ASC'
    ).fetchall()
    habits_list = [dict(h) for h in habits_rows]

    logs = conn.execute(
        '''SELECT habit_id, completed_date
           FROM Habit_Logs
           WHERE completed_date >= ? AND completed_date <= ?
           ORDER BY completed_date ASC''',
        (first_day.isoformat(), last_day.isoformat())
    ).fetchall()
    conn.close()

    days = {}
    for log in logs:
        d = log['completed_date']
        if d not in days:
            days[d] = []
        days[d].append(log['habit_id'])

    return jsonify({"year": year, "month": month, "days": days, "habits": habits_list})

# ─────────────────────────────────────────────────────────────────────────────
# RUN
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    app.run(debug=True, port=5000)