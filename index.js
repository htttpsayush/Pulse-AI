/* ═══════════════════════════════════════════════════════════════
   PulseAI Dashboard — index.js
   ═══════════════════════════════════════════════════════════════ */

const API = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
    ? 'http://127.0.0.1:8000'
    : 'https://pulseai-backend-9yj2.onrender.com';

const token = localStorage.getItem('token');
if (!token) window.location.href = 'auth.html';

// ─── Toast ──────────────────────────────────────────────────────
function showToast(msg, type = 'error') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast ${type} show`;
    setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── Logout ─────────────────────────────────────────────────────
function logout() {
    localStorage.removeItem('token');
    window.location.href = 'auth.html';
}

// ─── Auth Headers ───────────────────────────────────────────────
const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
};

// ─── Greeting ───────────────────────────────────────────────────
function setGreeting(name) {
    const h = new Date().getHours();
    let greet = 'Good Evening';
    if (h < 12) greet = 'Good Morning';
    else if (h < 17) greet = 'Good Afternoon';
    document.getElementById('greeting-text').textContent = `${greet}, ${name} 👋`;
}

function setDate() {
    const now = new Date();
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('date-text').textContent = now.toLocaleDateString('en-US', opts);
}
setDate();

// ─── Load User ──────────────────────────────────────────────────
let currentUser = null;

async function loadUser() {
    try {
        const res = await fetch(`${API}/users/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) { localStorage.removeItem('token'); window.location.href = 'auth.html'; return; }
        currentUser = await res.json();
        document.getElementById('sidebar-username').textContent = currentUser.name;
        document.getElementById('sidebar-avatar').textContent = currentUser.name.charAt(0).toUpperCase();
        document.getElementById('sidebar-role').textContent = currentUser.role === 'admin' ? 'Admin' : 'Member';
        setGreeting(currentUser.name.split(' ')[0]);
        if (currentUser.role === 'admin') {
            document.getElementById('admin-btn').style.display = 'flex';
        }
    } catch (err) {
        showToast('Failed to load user');
    }
}

// ─── Load Workouts ──────────────────────────────────────────────
let allWorkouts = [];

async function loadWorkouts() {
    try {
        const res = await fetch(`${API}/workouts/`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return;
        allWorkouts = await res.json();

        // Stats
        const total = allWorkouts.length;
        const completed = allWorkouts.filter(w => w.is_completed).length;
        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-completed').textContent = completed;
        document.getElementById('stat-streak').textContent = Math.min(completed, 7);

        // Workout ring (completed out of 5)
        setRing('ring-workout', completed, 5);
        document.getElementById('ring-workout-val').textContent = `${completed}/5`;

        // Render plan list
        renderPlanList();
    } catch (err) {
        console.error(err);
    }
}

function renderPlanList() {
    const list = document.getElementById('plan-list');
    if (allWorkouts.length === 0) {
        list.innerHTML = `<div class="empty-state"><i class="ri-calendar-check-line"></i><p>No workouts yet</p></div>`;
        return;
    }
    // Show latest 5
    const recent = allWorkouts.slice(0, 5);
    list.innerHTML = recent.map(w => `
        <div class="plan-item ${w.is_completed ? 'completed' : ''}" id="plan-${w.id}">
            <button class="plan-check ${w.is_completed ? 'checked' : ''}" onclick="toggleWorkout(${w.id})">
                <i class="ri-check-line"></i>
            </button>
            <div class="plan-text">
                <h4>${escapeHtml(w.name)}</h4>
                <p>${escapeHtml(w.detail)}</p>
            </div>
        </div>
    `).join('');
}

async function toggleWorkout(id) {
    try {
        const res = await fetch(`${API}/workouts/${id}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            await loadWorkouts();
        }
    } catch (err) {
        showToast('Failed to update workout');
    }
}

// ─── Activity Rings ─────────────────────────────────────────────
function setRing(id, value, max) {
    const circumference = 2 * Math.PI * 42; // 263.9
    const pct = Math.min(value / max, 1);
    const offset = circumference * (1 - pct);
    document.getElementById(id).style.strokeDashoffset = offset;
}

// ─── Meal History (for ring + chart) ────────────────────────────
let mealHistory = [];

async function loadMealHistory() {
    try {
        const res = await fetch(`${API}/api/meal/history`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        mealHistory = data.history || [];

        // Today's calories for ring
        const today = new Date().toISOString().split('T')[0];
        const todayMeal = mealHistory.find(m => m.date === today);
        const todayCal = todayMeal ? Math.round(todayMeal.total_calories) : 0;
        setRing('ring-cal', todayCal, 2000);
        document.getElementById('ring-cal-val').textContent = `${todayCal}`;

        // Build chart
        buildWeeklyChart();
    } catch (err) {
        console.error(err);
    }
}

// ─── Weekly Chart ───────────────────────────────────────────────
let weeklyChart = null;
let chartMode = 'calories';

function buildWeeklyChart() {
    const labels = [];
    const calData = [];
    const minData = [];

    // Last 7 days
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        labels.push(dayName);

        const entry = mealHistory.find(m => m.date === dateStr);
        calData.push(entry ? Math.round(entry.total_calories) : 0);
        minData.push(entry ? entry.meal_count * 15 : 0); // rough estimate
    }

    const ctx = document.getElementById('weekly-chart').getContext('2d');
    if (weeklyChart) weeklyChart.destroy();

    const dataset = chartMode === 'calories'
        ? { label: 'Calories', data: calData, borderColor: '#F5C518', backgroundColor: 'rgba(245,197,24,0.1)' }
        : { label: 'Minutes', data: minData, borderColor: '#4ADE80', backgroundColor: 'rgba(74,222,128,0.1)' };

    weeklyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                ...dataset,
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 4,
                pointBackgroundColor: dataset.borderColor,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#777', font: { size: 12 } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#777', font: { size: 12 } },
                    beginAtZero: true
                }
            }
        }
    });
}

function switchChart(mode, btn) {
    chartMode = mode;
    document.querySelectorAll('.chart-toggle button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    buildWeeklyChart();
}

// ─── Utility ────────────────────────────────────────────────────
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ─── Init ───────────────────────────────────────────────────────
(async function init() {
    await loadUser();
    await loadWorkouts();
    await loadMealHistory();
})();
