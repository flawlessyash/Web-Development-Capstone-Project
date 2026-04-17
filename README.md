# Momentum: Habit & Streak Tracker 🚀

## Project Overview
Momentum is a lightweight, mobile-responsive web application designed to help users build consistency through daily habit tracking. Users can add new habits, log their daily progress, and maintain streaks, with data validated to prevent duplicate daily logging.

## System Architecture & Data Flow
The application follows a clean client-server architecture.

1. **Frontend (UI/UX):** HTML, CSS, and Vanilla JavaScript. Handles the visual dashboard, search/filter functionality, and sends asynchronous fetch requests to the backend.
2. **Backend (API):** Python with Flask. Handles business logic, data validation, and routing.
3. **Database:** SQLite3. Stores relational data for habits and daily logs.

### Application Flowchart
*(You can use the following Mermaid.js code in GitHub, it will automatically render as a flowchart!)*

```mermaid
graph TD
    A[User Interface] -->|1. Creates Habit| B(Flask API: /api/habits)
    A -->|2. Clicks 'Log Daily Habit'| B
    B -->|Validates Data| C{Log exists for today?}
    C -->|Yes: Reject| B
    C -->|No: Accept| D[(SQLite Database)]
    D -->|Updates Streak| B
    B -->|Returns Success| A
    A -->|Updates Visual Dashboard| A