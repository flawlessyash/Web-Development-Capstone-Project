import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from supabase import create_client, Client
from datetime import date, timedelta
from dotenv import load_dotenv
from collections import defaultdict

# ── Setup ─────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))

app = Flask(__name__)
CORS(app)

# ── Supabase client ───────────────────────────────────────────────────────────
supabase: Client = create_client(
    os.environ['SUPABASE_URL'],
    os.environ['SUPABASE_KEY'],
)


# ── Health check ──────────────────────────────────────────────────────────────
@app.route('/')
def index():
    return jsonify({'status': 'Streakr API is running ✅'})


# ── GET /api/habits ───────────────────────────────────────────────────────────
@app.route('/api/habits', methods=['GET'])
def get_habits():
    today          = date.today().isoformat()
    seven_days_ago = (date.today() - timedelta(days=6)).isoformat()

    # 1. All habits newest-first
    habits_data = supabase.table('habits').select('*') \
        .order('created_at', desc=True).execute().data

    # 2. Which habits are already logged today?
    today_logs       = supabase.table('habit_logs').select('habit_id') \
        .eq('completed_date', today).execute().data
    logged_today_ids = {r['habit_id'] for r in today_logs}

    # 3. Last 7 days of logs for the bar chart (one batch query)
    recent_logs = supabase.table('habit_logs') \
        .select('habit_id, completed_date') \
        .gte('completed_date', seven_days_ago).execute().data

    history_map = defaultdict(list)
    for log in recent_logs:
        history_map[log['habit_id']].append(log['completed_date'])

    # 4. Build response
    for h in habits_data:
        h['logged_today'] = 1 if h['habit_id'] in logged_today_ids else 0
        h['history']      = sorted(history_map.get(h['habit_id'], []))
        if h.get('created_at'):
            h['created_at'] = str(h['created_at'])

    return jsonify(habits_data)


# ── POST /api/habits ──────────────────────────────────────────────────────────
@app.route('/api/habits', methods=['POST'])
def add_habit():
    data  = request.get_json()
    title = (data.get('title') or '').strip()

    if not title:
        return jsonify({'error': 'Title is required'}), 400
    if len(title) < 2:
        return jsonify({'error': 'Title must be at least 2 characters'}), 400

    category    = data.get('category', 'health')
    emoji       = data.get('emoji', '⭐')
    description = (data.get('description') or '').strip()
    goal        = data.get('goal', 'once')

    if category not in ['health', 'learning', 'productivity', 'mindfulness']:
        return jsonify({'error': 'Invalid category'}), 400

    new_habit = supabase.table('habits').insert({
        'title': title, 'category': category,
        'emoji': emoji, 'description': description, 'goal': goal,
    }).execute().data[0]

    new_habit['logged_today'] = 0
    new_habit['history']      = []
    if new_habit.get('created_at'):
        new_habit['created_at'] = str(new_habit['created_at'])

    return jsonify(new_habit), 201


# ── PUT /api/habits/<id> ──────────────────────────────────────────────────────
@app.route('/api/habits/<int:habit_id>', methods=['PUT'])
def update_habit(habit_id):
    data  = request.get_json()
    title = (data.get('title') or '').strip()

    if not title:
        return jsonify({'error': 'Title is required'}), 400
    if len(title) < 2:
        return jsonify({'error': 'Title must be at least 2 characters'}), 400

    category    = data.get('category', 'health')
    emoji       = data.get('emoji', '⭐')
    description = (data.get('description') or '').strip()
    goal        = data.get('goal', 'once')

    if category not in ['health', 'learning', 'productivity', 'mindfulness']:
        return jsonify({'error': 'Invalid category'}), 400

    if not supabase.table('habits').select('habit_id') \
            .eq('habit_id', habit_id).execute().data:
        return jsonify({'error': 'Habit not found'}), 404

    supabase.table('habits').update({
        'title': title, 'category': category,
        'emoji': emoji, 'description': description, 'goal': goal,
    }).eq('habit_id', habit_id).execute()

    return jsonify({'message': 'Habit updated successfully'}), 200


# ── DELETE /api/habits/<id> ───────────────────────────────────────────────────
@app.route('/api/habits/<int:habit_id>', methods=['DELETE'])
def delete_habit(habit_id):
    if not supabase.table('habits').select('habit_id') \
            .eq('habit_id', habit_id).execute().data:
        return jsonify({'error': 'Habit not found'}), 404

    supabase.table('habits').delete().eq('habit_id', habit_id).execute()
    return jsonify({'message': 'Habit deleted successfully'}), 200


# ── POST /api/habits/<id>/log ─────────────────────────────────────────────────
@app.route('/api/habits/<int:habit_id>/log', methods=['POST'])
def log_habit(habit_id):
    today     = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    habit_data = supabase.table('habits').select('*') \
        .eq('habit_id', habit_id).execute().data
    if not habit_data:
        return jsonify({'error': 'Habit not found'}), 404
    habit = habit_data[0]

    # Check already logged today (no exception needed — explicit check)
    if supabase.table('habit_logs').select('log_id') \
            .eq('habit_id', habit_id).eq('completed_date', today).execute().data:
        return jsonify({'error': 'Habit already logged for today'}), 400

    # Insert today's log
    supabase.table('habit_logs').insert({
        'habit_id': habit_id, 'completed_date': today,
    }).execute()

    # Streak: continue if last log was yesterday, else reset to 1
    last_log = supabase.table('habit_logs').select('completed_date') \
        .eq('habit_id', habit_id) \
        .lt('completed_date', today) \
        .order('completed_date', desc=True) \
        .limit(1).execute().data

    new_streak = (habit['current_streak'] + 1) \
        if (last_log and last_log[0]['completed_date'] == yesterday) else 1
    new_best   = max(new_streak, habit['best_streak'])

    supabase.table('habits').update({
        'current_streak': new_streak, 'best_streak': new_best,
    }).eq('habit_id', habit_id).execute()

    return jsonify({
        'message':        'Habit logged successfully',
        'current_streak': new_streak,
        'best_streak':    new_best,
    }), 200


# ── GET /api/calendar?month=YYYY-MM ──────────────────────────────────────────
@app.route('/api/calendar', methods=['GET'])
def get_calendar():
    month_str = request.args.get('month', date.today().strftime('%Y-%m'))
    try:
        year, month = int(month_str[:4]), int(month_str[5:7])
        if not (1 <= month <= 12):
            raise ValueError
    except (ValueError, IndexError):
        return jsonify({'error': 'Invalid month format. Use YYYY-MM'}), 400

    first_day = date(year, month, 1)
    last_day  = date(year + (month // 12), (month % 12) + 1, 1) - timedelta(days=1)

    habits_list = supabase.table('habits') \
        .select('habit_id, title, emoji, category') \
        .order('created_at').execute().data

    logs = supabase.table('habit_logs').select('habit_id, completed_date') \
        .gte('completed_date', first_day.isoformat()) \
        .lte('completed_date', last_day.isoformat()) \
        .order('completed_date').execute().data

    days = {}
    for log in logs:
        d = log['completed_date']
        days.setdefault(d, []).append(log['habit_id'])

    return jsonify({'year': year, 'month': month, 'days': days, 'habits': habits_list})


# ── Run ───────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    app.run(debug=True, port=5001)