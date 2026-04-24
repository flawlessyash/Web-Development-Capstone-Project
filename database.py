import sqlite3

def init_db():
    # Connect to the SQLite database (creates it if it doesn't exist)
    conn = sqlite3.connect('momentum.db')
    cursor = conn.cursor()

    # Create the Habits table
    # habit_id: Primary Key
    # title: Name of the habit
    # created_at: Timestamp of when the habit was created
    # current_streak: Number of consecutive days the habit has been completed
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS Habits (
            habit_id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            current_streak INTEGER DEFAULT 0
        )
    ''')

    # Create the Habit_Logs table
    # log_id: Primary Key
    # habit_id: Foreign key linking to the Habits table
    # completed_date: The date (YYYY-MM-DD) the habit was completed
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS Habit_Logs (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            habit_id INTEGER,
            completed_date DATE NOT NULL,
            FOREIGN KEY (habit_id) REFERENCES Habits(habit_id),
            UNIQUE(habit_id, completed_date) -- Prevents duplicate logs for the same habit on the same day
        )
    ''')

    # Insert some initial dummy data if the database is empty
    cursor.execute("SELECT COUNT(*) FROM Habits")
    if cursor.fetchone()[0] == 0:
        sample_habits = [
            ("Drink 2L Water",),
            ("Read 10 Pages",),
            ("Code for 1 Hour",),
            ("Morning Walk",)
        ]
        cursor.executemany("INSERT INTO Habits (title) VALUES (?)", sample_habits)
        print("Inserted sample habits.")

    # Commit changes and close the connection
    conn.commit()
    conn.close()
    print("Database initialized successfully.")

if __name__ == '__main__':
    init_db()
