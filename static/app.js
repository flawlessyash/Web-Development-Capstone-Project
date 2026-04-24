document.addEventListener('DOMContentLoaded', () => {
    
    // DOM Elements
    const habitList = document.getElementById('habitList');
    const searchInput = document.getElementById('habitSearch');
    const dateSubtitle = document.getElementById('date-subtitle');
    
    // Modal Elements
    const modal = document.getElementById('habitModal');
    const openModalBtn = document.getElementById('openModalBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const newHabitForm = document.getElementById('newHabitForm');
    const habitTitleInput = document.getElementById('habitTitle');

    // Display formatted date
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateSubtitle.innerText = new Date().toLocaleDateString('en-US', options);

    // Initial Fetch on Load
    loadHabits();

    /* ==========================
       API & Render Logic
       ========================== */

    // Fetch all habits from the backend
    async function loadHabits() {
        try {
            const response = await fetch('/api/habits');
            const habits = await response.json();
            renderHabits(habits);
        } catch (error) {
            console.error('Error fetching habits:', error);
            habitList.innerHTML = `<li class="habit-item skeleton">Error loading habits. Please refresh.</li>`;
        }
    }

    // Render habits list to DOM
    function renderHabits(habits) {
        habitList.innerHTML = ''; // Clear skeleton/existing

        if (habits.length === 0) {
            habitList.innerHTML = `<li class="habit-item skeleton">No habits yet. Create one!</li>`;
            return;
        }

        habits.forEach(habit => {
            const li = createHabitElement(habit);
            habitList.appendChild(li);
        });
    }

    // Create a single habit DOM Element
    function createHabitElement(habit) {
        const li = document.createElement('li');
        li.className = 'habit-item';
        // Add completion class if already logged today
        if (habit.logged_today === 1) {
            li.classList.add('completed');
        }
        
        // Store title as dataset attribute for easy searching
        li.dataset.title = habit.title.toLowerCase();

        // Template logic
        li.innerHTML = `
            <div class="habit-info">
                <span class="habit-title">${habit.title}</span>
                <span class="habit-streak ${habit.current_streak > 2 ? 'fire' : ''}" id="streak-${habit.habit_id}">
                    ${habit.current_streak > 0 ? `🔥 ${habit.current_streak} Day Streak` : 'Let\'s start!'}
                </span>
            </div>
            <input type="checkbox" class="habit-check" 
                id="check-${habit.habit_id}" 
                data-id="${habit.habit_id}"
                ${habit.logged_today === 1 ? 'checked disabled' : ''}>
        `;

        // Add event listener to the checkbox
        const checkbox = li.querySelector('.habit-check');
        checkbox.addEventListener('change', (e) => handleLogEvent(e, habit.habit_id, li));

        return li;
    }

    /* ==========================
       Interaction Handlers
       ========================== */

    // Handle habit log click
    async function handleLogEvent(event, habitId, liElement) {
        const checkbox = event.target;
        checkbox.disabled = true; // Prevent double taps

        try {
            const response = await fetch(`/api/habits/${habitId}/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const result = await response.json();
                
                // Update UI for success
                liElement.classList.add('completed');
                checkbox.checked = true;
                
                // Update streak text visually
                const streakSpan = document.getElementById(`streak-${habitId}`);
                streakSpan.innerHTML = `🔥 ${result.current_streak} Day Streak`;
                if(result.current_streak > 2) streakSpan.classList.add('fire');

            } else {
                const err = await response.json();
                console.error('Failed to log:', err);
                alert(err.error || 'Could not log habit');
                checkbox.checked = false; // Revert visually
                checkbox.disabled = false;
            }
        } catch (error) {
            console.error('Network Error:', error);
            checkbox.checked = false;
            checkbox.disabled = false;
        }
    }

    /* ==========================
       Modal Logic
       ========================== */

    openModalBtn.addEventListener('click', () => modal.classList.add('active'));
    
    closeModalBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        newHabitForm.reset();
    });

    // Close modal if clicking outside the card
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            newHabitForm.reset();
        }
    });

    // Handle new habit submission
    newHabitForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const titleVal = habitTitleInput.value.trim();
        if (!titleVal) return;

        const btn = newHabitForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerText = "Adding...";

        try {
            const response = await fetch('/api/habits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: titleVal })
            });

            if (response.ok) {
                const newHabit = await response.json();
                const li = createHabitElement(newHabit);
                
                // Remove skeleton if it's the first habit
                if (habitList.querySelector('.skeleton')) {
                    habitList.innerHTML = '';
                }
                
                // Prepend to list
                habitList.prepend(li);
                
                // Reset UI
                modal.classList.remove('active');
                newHabitForm.reset();
            } else {
                alert('Error creating habit');
            }
        } catch (error) {
            console.error('Error submitting habit:', error);
            alert('Network error');
        } finally {
            btn.disabled = false;
            btn.innerText = "Add Habit";
        }
    });

    /* ==========================
       Search / Filter Logic
       ========================== */

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const items = habitList.querySelectorAll('.habit-item:not(.skeleton)');
        
        items.forEach(item => {
            // Check dataset title vs search term
            if (item.dataset.title.includes(term)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });

});
