const API_BASE = '/api';
let token = null;
let currentUser = { is_admin: false };
let currentView = 'movies';

// Pagination & filter state
let currentPage = 1;
let perPage = 10;
let searchText = '';
let genreFilter = '';
let yearFrom = '';
let yearTo = '';
let minRating = '';

// ─── API helper ──────────────────────────────────────────────────────────────

async function apiFetch(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    if (res.status === 401) { logout(); throw new Error('Session expired'); }
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail);
        token = data.access_token;
        currentUser.is_admin = data.is_admin;
        localStorage.setItem('token', token);
        localStorage.setItem('is_admin', data.is_admin);
        showDashboard();
    } catch (err) {
        document.querySelector('#login-form .error-msg').innerText = err.message;
    }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        full_name: document.getElementById('reg-name').value,
        username: document.getElementById('reg-username').value,
        email: document.getElementById('reg-email').value,
        password: document.getElementById('reg-password').value
    };
    try {
        await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
        alert('Registration successful! Please login.');
        document.querySelector('.tab-btn[data-tab="login"]').click();
    } catch (err) { alert(err.message); }
});

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
        document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
    });
});

// ─── Dashboard ───────────────────────────────────────────────────────────────

function showDashboard() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('user-role').innerText = currentUser.is_admin ? 'Admin' : 'Client';
    if (currentUser.is_admin) {
        document.getElementById('admin-users-menu').style.display = 'block';
        document.getElementById('admin-upload-menu').style.display = 'block';
    }
    loadView('movies');
    attachSidebarEvents();
    document.getElementById('logout-btn').onclick = logout;
}

function logout() {
    localStorage.clear();
    token = null;
    location.reload();
}

function attachSidebarEvents() {
    document.querySelectorAll('.sidebar li').forEach(li => {
        li.onclick = () => loadView(li.dataset.view);
    });
}

async function loadView(view) {
    currentView = view;
    const container = document.getElementById('view-container');

    if (view === 'movies') {
        // Reset pagination/filters when switching to movies view
        currentPage = 1;
        await renderMovies();

    } else if (view === 'stats') {
        if (currentUser.is_admin) {
            const stats = await apiFetch('/admin/stats');
            container.innerHTML = `
                <div class="stats-grid">
                    <div class="stat-card"><h3>Total Movies</h3><p>${stats.total_movies}</p></div>
                    <div class="stat-card"><h3>Total Users</h3><p>${stats.total_users}</p></div>
                    <div class="stat-card"><h3>Avg Rating</h3><p>${stats.average_rating.toFixed(1)}</p></div>
                </div>
                <h3>Type Distribution</h3>
                <ul>${stats.type_distribution.map(t => `<li>${t.type}: ${t.count}</li>`).join('')}</ul>
            `;
        } else {
            container.innerHTML = '<div class="stat-card"><p>Client stats view (limited)</p></div>';
        }

    } else if (view === 'users' && currentUser.is_admin) {
        const users = await apiFetch('/admin/users');
        container.innerHTML = `
            <h2>Users</h2>
            <table>
                <thead><tr><th>ID</th><th>Email</th><th>Role</th><th>Action</th></tr></thead>
                <tbody>
                    ${users.map(u => `
                        <tr>
                            <td>${u.id}</td>
                            <td>${u.email}</td>
                            <td>${u.is_admin ? 'Admin' : 'Client'}</td>
                            <td><button class="delete-user" data-id="${u.id}">Delete</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        document.querySelectorAll('.delete-user').forEach(btn => {
            btn.onclick = async () => {
                if (confirm('Delete user?')) {
                    await apiFetch(`/admin/users/${btn.dataset.id}`, { method: 'DELETE' });
                    loadView('users');
                }
            };
        });

    } else if (view === 'upload' && currentUser.is_admin) {
        container.innerHTML = `
            <h2>Upload JSON Data</h2>
            <input type="file" id="json-file" accept=".json">
            <button id="upload-btn" style="margin-top:1rem;">Upload & Import</button>
            <div id="upload-status" style="margin-top:1rem;"></div>
        `;
        document.getElementById('upload-btn').onclick = async () => {
            const file = document.getElementById('json-file').files[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch(`${API_BASE}/admin/upload-json`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await res.json();
            document.getElementById('upload-status').innerText = data.message || 'Uploaded';
            setTimeout(() => loadView('movies'), 1500);
        };
    }
}

// ─── Movies view ─────────────────────────────────────────────────────────────

// BUG FIX 2: renderMovies() was defined as renderMovies(movies) — it accepted
// already-fetched data as a parameter but was always called with NO arguments,
// so `movies` was undefined, crashing on movies.length. It also NEVER called
// the API. Rewritten below: renders the filter UI, then calls fetchAndRender().

async function renderMovies() {
    const container = document.getElementById('view-container');

    // Render filter bar + table placeholder + pagination placeholder
    container.innerHTML = `
        <div class="filters">
            <input type="text"   id="search-input" placeholder="Search title…"  value="${searchText}">
            <input type="text"   id="genre-input"  placeholder="Genre…"         value="${genreFilter}">
            <input type="number" id="year-from"    placeholder="Year from"      value="${yearFrom}">
            <input type="number" id="year-to"      placeholder="Year to"        value="${yearTo}">
            <input type="number" id="min-rating"   placeholder="Min rating" step="0.1" min="0" max="10" value="${minRating}">
            <button id="apply-filters" style="width:auto;padding:0.6rem 1.2rem;">Apply</button>
        </div>
        <div id="movies-table">Loading…</div>
        <div class="pagination" id="pagination"></div>
    `;

    document.getElementById('apply-filters').onclick = () => {
        searchText  = document.getElementById('search-input').value;
        genreFilter = document.getElementById('genre-input').value;
        yearFrom    = document.getElementById('year-from').value;
        yearTo      = document.getElementById('year-to').value;
        minRating   = document.getElementById('min-rating').value;
        currentPage = 1;
        fetchAndRenderMovies();
    };

    await fetchAndRenderMovies();
}

async function fetchAndRenderMovies() {
    const tableDiv = document.getElementById('movies-table');
    if (!tableDiv) return;   // view was switched before fetch completed

    const params = new URLSearchParams({
        page:      currentPage,
        per_page:  perPage,
        search:    searchText,
        genre:     genreFilter,
        year_from: yearFrom,
        year_to:   yearTo,
        min_rating: minRating,
    });

    try {
        const data = await apiFetch(`/movies?${params}`);

        if (!data.items.length) {
            tableDiv.innerHTML = '<p style="padding:40px;text-align:center;">No movies found.</p>';
        } else {
            tableDiv.innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>ID</th><th>Title</th><th>Type</th>
                            <th>Year</th><th>Rating</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.items.map(m => `
                            <tr>
                                <td>${m.id}</td>
                                <td><strong>${escapeHtml(m.primaryTitle)}</strong></td>
                                <td>${m.type || '-'}</td>
                                <td>${m.startYear || '-'}</td>
                                <td>${m.averageRating || '-'}</td>
                                <td>
                                    <button class="view-movie" data-id="${m.id}">View</button>
                                    ${currentUser.is_admin
                                        ? `<button class="delete-movie" data-id="${m.id}">Delete</button>`
                                        : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            document.querySelectorAll('.view-movie').forEach(btn =>
                btn.onclick = () => viewMovieDetail(btn.dataset.id)
            );

            if (currentUser.is_admin) {
                document.querySelectorAll('.delete-movie').forEach(btn => {
                    btn.onclick = async () => {
                        if (confirm('Delete this movie?')) {
                            await apiFetch(`/movies/${btn.dataset.id}`, { method: 'DELETE' });
                            fetchAndRenderMovies();
                        }
                    };
                });
            }
        }

        // Render pagination buttons
        const paginationDiv = document.getElementById('pagination');
        if (paginationDiv) {
            paginationDiv.innerHTML = '';
            for (let i = 1; i <= data.total_pages; i++) {
                const btn = document.createElement('button');
                btn.textContent = i;
                if (i === currentPage) btn.classList.add('active');
                btn.onclick = () => { currentPage = i; fetchAndRenderMovies(); };
                paginationDiv.appendChild(btn);
            }
        }

    } catch (err) {
        if (tableDiv) {
            tableDiv.innerHTML = `<p style="color:red;padding:20px;">Error: ${err.message}</p>`;
        }
    }
}

// ─── Movie detail ─────────────────────────────────────────────────────────────

async function viewMovieDetail(id) {
    try {
        const movie = await apiFetch(`/movies/${id}`);
        alert(
            `Title: ${movie.primaryTitle}\n` +
            `Description: ${movie.description || 'N/A'}\n` +
            `Rating: ${movie.averageRating || 'N/A'}\n` +
            `Year: ${movie.startYear || 'N/A'}`
        );
    } catch (err) {
        alert('Could not load movie details: ' + err.message);
    }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]);
}

// ─── Init: restore session from localStorage ──────────────────────────────────

const savedToken = localStorage.getItem('token');
if (savedToken) {
    token = savedToken;
    currentUser.is_admin = localStorage.getItem('is_admin') === 'true';
    showDashboard();
}