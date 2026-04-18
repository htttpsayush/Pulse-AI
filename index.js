/* index.js — PulseAI Dashboard */

const token = localStorage.getItem('token');

const API_BASE =
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === 'localhost'
        ? 'https://pulseai-backend-9yj2.onrender.com'
        : '';

if (!token) {
    window.location.href = 'auth.html';
}

document.addEventListener('DOMContentLoaded', () => {
    initUser();
    initDate();
    initRings();
    initWorkoutList();
    initChart();
    initNav();
});

function initDate() {
    const dateEl = document.getElementById('current-date');

    if (dateEl) {
        const options = {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
        };

        dateEl.innerHTML = `
            <i class="ri-calendar-line"></i>
            ${new Date().toLocaleDateString('en-US', options)}
        `;
    }
}

function initUser() {
    if (!token) return;

    fetch(`${API_BASE}/users/me`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    })
        .then(res => {
            if (!res.ok) {
                localStorage.removeItem('token');
                window.location.href = 'auth.html';
                throw new Error('Unauthorized');
            }
            return res.json();
        })
        .then(user => {
            document.querySelector('.greeting h1').innerHTML =
                `Good Morning, ${user.name} <span class="wave">👋</span>`;

            const sidebarName = document.getElementById('sidebar-username');
            if (sidebarName) {
                sidebarName.textContent = user.name;
            }

            if (user.role === 'admin') {
                const existingBtn = document.querySelector('.btn-admin');

                if (!existingBtn) {
                    const adminBtn = document.createElement('a');
                    adminBtn.href = 'admin.html';
                    adminBtn.className = 'btn-admin';
                    adminBtn.innerHTML =
                        '<i class="ri-shield-user-fill"></i> Admin Panel';

                    document.querySelector('.header-actions').prepend(adminBtn);
                }
            }

            return fetch(`${API_BASE}/workouts/`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
        })
        .then(res => {
            if (!res) return null;
            return res.json();
        })
        .then(workouts => {
            if (!workouts) return;

            document.querySelector(
                '.stats-row .stat-card:first-child .stat-value'
            ).textContent = workouts.length;

            const completed = workouts.filter(w => w.is_completed).length;

            document.querySelector(
                '.stats-row .stat-card:nth-child(2) .stat-value'
            ).textContent = completed;
        })
        .catch(err => {
            console.error('User initialization failed:', err);
        });
}

function initRings() {
    setTimeout(() => {
        const rings = document.querySelectorAll('.ring-front');

        rings.forEach(ring => {
            const percent =
                ring
                    .getAttribute('style')
                    ?.match(/--percent:\s*(\d+)/)?.[1] || 0;

            const offset = 314 - (314 * percent) / 100;
            ring.style.strokeDashoffset = offset;
        });
    }, 500);
}

function initWorkoutList() {
    const listContainer = document.getElementById('workout-list');

    if (!listContainer || !token) return;

    fetch(`${API_BASE}/workouts/`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    })
        .then(res => {
            if (!res.ok) {
                throw new Error('Failed to load workouts');
            }
            return res.json();
        })
        .then(workouts => {
            if (!Array.isArray(workouts) || workouts.length === 0) {
                listContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="ri-calendar-todo-line"></i>
                        <p>No workouts planned yet</p>
                    </div>
                `;
                return;
            }

            listContainer.innerHTML = workouts
                .map(
                    workout => `
                    <div class="workout-item ${
                        workout.is_completed ? 'completed' : ''
                    }" id="item-${workout.id}">
                        <div class="workout-main">
                            <div class="workout-icon">
                                <i class="ri-run-fill"></i>
                            </div>
                            <div class="workout-info">
                                <h4>${workout.name}</h4>
                                <p>${workout.detail}</p>
                            </div>
                        </div>

                        <div class="checkbox-wrapper">
                            <input
                                type="checkbox"
                                id="w-${workout.id}"
                                ${workout.is_completed ? 'checked' : ''}
                                onchange="toggleWorkout(${workout.id})"
                            >
                            <div class="checkbox-custom"></div>
                        </div>
                    </div>
                `
                )
                .join('');
        })
        .catch(err => {
            console.error(err);

            listContainer.innerHTML = `
                <div class="empty-state">
                    <i class="ri-wifi-off-line"></i>
                    <p>Could not load workouts</p>
                </div>
            `;
        });
}

window.toggleWorkout = function (id) {
    fetch(`${API_BASE}/workouts/${id}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${token}`
        }
    })
        .then(res => {
            if (!res.ok) {
                throw new Error('Failed to update workout');
            }
            return res.json();
        })
        .then(data => {
            const item = document.getElementById(`item-${id}`);
            if (!item) return;

            if (data.is_completed) {
                item.classList.add('completed');
            } else {
                item.classList.remove('completed');
            }
        })
        .catch(err => {
            console.error(err);
        });
};

let progressChart;

function initChart() {
    const canvas = document.getElementById('progressChart');

    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const dataCalories = [0, 0, 0, 0, 0, 0, 0];
    const dataMinutes = [0, 0, 0, 0, 0, 0, 0];

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(245, 197, 24, 0.4)');
    gradient.addColorStop(1, 'rgba(245, 197, 24, 0)');

    progressChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [
                {
                    label: 'Calories Burned',
                    data: dataCalories,
                    borderColor: '#F5C518',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    pointBackgroundColor: '#141414',
                    pointBorderColor: '#F5C518',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#1A1A1A',
                    titleColor: '#888',
                    bodyColor: '#FFF',
                    borderColor: '#222',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: context =>
                            `${context.parsed.y} ${
                                context.dataset.label.split(' ')[0]
                            }`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255,255,255,0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#888'
                    }
                },
                x: {
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        color: '#888'
                    }
                }
            }
        }
    });

    document.querySelectorAll('.chart-toggle').forEach(button => {
        button.addEventListener('click', e => {
            document
                .querySelectorAll('.chart-toggle')
                .forEach(btn => btn.classList.remove('active'));

            e.currentTarget.classList.add('active');

            const dataset = e.currentTarget.dataset.dataset;

            progressChart.data.datasets[0].data =
                dataset === 'calories' ? dataCalories : dataMinutes;

            progressChart.data.datasets[0].label =
                dataset === 'calories'
                    ? 'Calories Burned'
                    : 'Minutes Active';

            progressChart.update();
        });
    });
}

function initNav() {
    const navItems = document.querySelectorAll('.nav-item[data-nav]');

    navItems.forEach(item => {
        item.addEventListener('click', e => {
            const href = item.getAttribute('href');

            if (href && href !== '#') return;

            e.preventDefault();

            const target = item.dataset.nav;

            navItems.forEach(nav => nav.classList.remove('active'));

            document
                .querySelectorAll(`.nav-item[data-nav="${target}"]`)
                .forEach(nav => nav.classList.add('active'));
        });
    });
}