from flask import Flask, render_template, request, jsonify
import sqlite3
from datetime import datetime, date

app = Flask(__name__)

# Utility function to get a database connection
def get_db_connection():
    conn = sqlite3.connect('momentum.db')
    conn.row_factory = sqlite3.Row  # Enables accessing columns by name
    return conn

# Route to render the frontend
@app.route('/')
def index():
    return render_template('index.html')

# API Route to fetch all habits
@app.route('/api/habits', methods=['GET'])
def get_habits():
    conn = get_db_connection()
    today = date.today().isoformat()
    
    # Query all habits, and use a LEFT JOIN with Habit_Logs to determine
    # if the habit has already been logged specifically for TODAY.
    query = '''
        SELECT 
            h.habit_id, 
            h.title, 
            h.current_streak,
            CASE WHEN hl.log_id IS NOT NULL THEN 1 ELSE 0 END as logged_today
        FROM Habits h
        LEFT JOIN Habit_Logs hl ON h.habit_id = hl.habit_id AND hl.completed_date = ?
        ORDER BY h.created_at DESC
    '''
    
    habits = conn.execute(query, (today,)).fetchall()
    conn.close()
    
    habits_list = [dict(row) for row in habits]
    return jsonify(habits_list)

# API Route to create a new habit
@app.route('/api/habits', methods=['POST'])
def add_habit():
    data = request.get_json()
    title = data.get('title')
    
    if not title or title.strip() == '':
        return jsonify({"error": "Title is required"}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Insert new habit with initial defaults
    cursor.execute('INSERT INTO Habits (title) VALUES (?)', (title.strip(),))
    habit_id = cursor.lastrowid
    
    conn.commit()
    conn.close()
    
    return jsonify({
        "habit_id": habit_id, 
        "title": title.strip(), 
        "current_streak": 0, 
        "logged_today": 0
    }), 201

# API Route to log a habit for today
@app.route('/api/habits/<int:habit_id>/log', methods=['POST'])
def log_habit(habit_id):
    today = date.today().isoformat()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Attempt to insert a log entry for today. 
        # By our schema, UNIQUE(habit_id, completed_date) will trigger an error if it already exists.
        cursor.execute(
            'INSERT INTO Habit_Logs (habit_id, completed_date) VALUES (?, ?)', 
            (habit_id, today)
        )
        
        # If successfully logged for the first time today, increment the streak
        cursor.execute(
            'UPDATE Habits SET current_streak = current_streak + 1 WHERE habit_id = ?', 
            (habit_id,)
        )
        
        # Get updated streak to return
        cursor.execute('SELECT current_streak FROM Habits WHERE habit_id = ?', (habit_id,))
        new_streak = cursor.fetchone()['current_streak']
        
        conn.commit()
        return jsonify({"message": "Habit logged successfully", "current_streak": new_streak}), 200
        
    except sqlite3.IntegrityError:
        # If it fails, that means we already logged it today.
        conn.rollback()
        return jsonify({"error": "Habit already logged for today"}), 400
    finally:
        conn.close()

if __name__ == '__main__':
    # Run the app locally in debug mode
    app.run(debug=True, port=5000)
