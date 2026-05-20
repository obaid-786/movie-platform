const API_BASE = '/api';
let token = null;
let currentUser = { is_admin: false };
let currentView = 'movies';

// Helper for fetch with auth
async function apiFetch(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    if (res.status === 401) { logout(); throw new Error('Session expired'); }
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

// Auth
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);
        const res = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formData });
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
        container.innerHTML = `<h2>Users</h2><table><thead><tr><th>ID</th><th>Email</th><th>Role</th><th>Action</th></tr></thead><tbody>
            ${users.map(u => `<tr><td>${u.id}</td><td>${u.email}</td><td>${u.is_admin ? 'Admin' : 'Client'}</td><td><button class="delete-user" data-id="${u.id}">Delete</button></td></tr>`).join('')}
        </tbody></table>`;
        document.querySelectorAll('.delete-user').forEach(btn => btn.onclick = async () => {
            if (confirm('Delete user?')) await apiFetch(`/admin/users/${btn.dataset.id}`, { method: 'DELETE' });
            loadView('users');
        });
    } else if (view === 'upload' && currentUser.is_admin) {
        container.innerHTML = `<h2>Upload JSON Data</h2><input type="file" id="json-file" accept=".json"><button id="upload-btn">Upload & Import</button><div id="upload-status"></div>`;
        document.getElementById('upload-btn').onclick = async () => {
            const file = document.getElementById('json-file').files[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch(`${API_BASE}/admin/upload-json`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
            const data = await res.json();
            document.getElementById('upload-status').innerText = data.message || 'Uploaded';
            setTimeout(() => loadView('movies'), 1500);
        };
    }
}

// Movies view with pagination, filters, modals
let currentPage = 1;
let perPage = 10;
let searchText = '';
let genreFilter = '';
let yearFrom = '';
let yearTo = '';
let minRating = '';

async function renderMovies() {
    const params = new URLSearchParams({
        page: currentPage,
        per_page: perPage,
        search: searchText,
        genre: genreFilter,
        year_from: yearFrom,
        year_to: yearTo,
        min_rating: minRating
    });
    const data = await apiFetch(`/movies?${params}`);
    const movies = data.items;
    const container = document.getElementById('view-container');
    let html = `
        <div class="filters">
            <input type="text" id="search-input" placeholder="Search title/description" value="${searchText}">
            <input type="text" id="genre-input" placeholder="Genre" value="${genreFilter}">
            <input type="number" id="year-from" placeholder="Year from" value="${yearFrom}">
            <input type="number" id="year-to" placeholder="Year to" value="${yearTo}">
            <input type="number" step="0.1" id="min-rating" placeholder="Min rating" value="${minRating}">
            <button id="apply-filters">Apply</button>
            <label>Per page: <select id="per-page-select">${[5,10,25,50].map(v => `<option ${perPage==v?'selected':''} value="${v}">${v}</option>`).join('')}</select></label>
            ${currentUser.is_admin ? '<button id="add-movie-btn">+ Add Movie</button>' : ''}
        </div>
        <table><thead><tr><th>Title</th><th>Type</th><th>Year</th><th>Rating</th><th>Actions</th></tr></thead><tbody>
    `;
    movies.forEach(m => {
        html += `<tr>
            <td><strong>${escapeHtml(m.primaryTitle)}</strong></td>
            <td>${m.type || '-'}</td>
            <td>${m.startYear || '-'}</td>
            <td>${m.averageRating || '-'}</td>
            <td><button class="view-movie" data-id="${m.id}">View</button> ${currentUser.is_admin ? `<button class="edit-movie" data-id="${m.id}">Edit</button> <button class="delete-movie" data-id="${m.id}">Delete</button>` : ''}</td>
        </tr>`;
    });
    html += `</tbody></table>`;
    // Pagination buttons
    const totalPages = data.total_pages;
    html += `<div class="pagination"><button id="first-page" ${currentPage===1?'disabled':''}>First</button><button id="prev-page" ${currentPage===1?'disabled':''}>Previous</button>`;
    for (let i = Math.max(1, currentPage-2); i <= Math.min(totalPages, currentPage+2); i++) {
        html += `<button class="page-num ${i===currentPage?'active':''}" data-page="${i}">${i}</button>`;
    }
    html += `<button id="next-page" ${currentPage===totalPages?'disabled':''}>Next</button><button id="last-page" ${currentPage===totalPages?'disabled':''}>Last</button></div>`;
    container.innerHTML = html;

    // Attach events
    document.getElementById('apply-filters').onclick = () => {
        searchText = document.getElementById('search-input').value;
        genreFilter = document.getElementById('genre-input').value;
        yearFrom = document.getElementById('year-from').value;
        yearTo = document.getElementById('year-to').value;
        minRating = document.getElementById('min-rating').value;
        currentPage = 1;
        renderMovies();
    };
    document.getElementById('per-page-select').onchange = (e) => { perPage = parseInt(e.target.value); currentPage=1; renderMovies(); };
    document.getElementById('first-page').onclick = () => { currentPage=1; renderMovies(); };
    document.getElementById('prev-page').onclick = () => { if(currentPage>1) { currentPage--; renderMovies(); } };
    document.getElementById('next-page').onclick = () => { if(currentPage<totalPages) { currentPage++; renderMovies(); } };
    document.getElementById('last-page').onclick = () => { currentPage=totalPages; renderMovies(); };
    document.querySelectorAll('.page-num').forEach(btn => btn.onclick = () => { currentPage = parseInt(btn.dataset.page); renderMovies(); });
    document.querySelectorAll('.view-movie').forEach(btn => btn.onclick = () => viewMovieDetail(btn.dataset.id));
    if (currentUser.is_admin) {
        document.getElementById('add-movie-btn').onclick = () => openMovieModal();
        document.querySelectorAll('.edit-movie').forEach(btn => btn.onclick = () => openMovieModal(btn.dataset.id));
        document.querySelectorAll('.delete-movie').forEach(btn => btn.onclick = async () => { if(confirm('Delete?')) { await apiFetch(`/movies/${btn.dataset.id}`, {method:'DELETE'}); renderMovies(); } });
    }
}

function escapeHtml(str) { if(!str) return ''; return str.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[m]); }

async function viewMovieDetail(id) {
    const movie = await apiFetch(`/movies/${id}`);
    alert(`Title: ${movie.primaryTitle}\nDescription: ${movie.description || 'N/A'}\nRating: ${movie.averageRating}\nGenres: ${(movie.genres||[]).map(g=>g.name).join(', ')}`);
}

function openMovieModal(id = null) {
    // simplified: show modal to create/edit movie (implementation omitted for brevity)
    alert(id ? 'Edit movie feature' : 'Add movie feature - implement modal form');
}

// Load initial token from storage
const savedToken = localStorage.getItem('token');
if (savedToken) {
    token = savedToken;
    currentUser.is_admin = localStorage.getItem('is_admin') === 'true';
    showDashboard();
}