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
    const email    = document.getElementById('login-email').value;
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
        username:  document.getElementById('reg-username').value,
        email:     document.getElementById('reg-email').value,
        password:  document.getElementById('reg-password').value
    };
    try {
        await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
        alert('Registration successful! Please login.');
        document.querySelector('.tab-btn[data-tab="login"]').click();
    } catch (err) { alert(err.message); }
});

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        document.getElementById('login-form').style.display    = tab === 'login'    ? 'block' : 'none';
        document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
    });
});

// ─── Dashboard ───────────────────────────────────────────────────────────────

function showDashboard() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('dashboard').style.display    = 'block';
    document.getElementById('user-role').innerText        = currentUser.is_admin ? 'Admin' : 'Client';
    if (currentUser.is_admin) {
        document.getElementById('admin-users-menu').style.display  = 'block';
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

// ─── Movies list view ─────────────────────────────────────────────────────────

async function renderMovies() {
    const container = document.getElementById('view-container');
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
    if (!tableDiv) return;

    const params = new URLSearchParams({
        page: currentPage, per_page: perPage,
        search: searchText, genre: genreFilter,
        year_from: yearFrom, year_to: yearTo, min_rating: minRating,
    });

    try {
        const data = await apiFetch(`/movies?${params}`);

        if (!data.items.length) {
            tableDiv.innerHTML = '<p style="padding:40px;text-align:center;">No movies found.</p>';
        } else {
            tableDiv.innerHTML = `
                <table>
                    <thead>
                        <tr><th>Title</th><th>Type</th><th>Year</th><th>Rating</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        ${data.items.map(m => `
                            <tr>
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
        if (tableDiv) tableDiv.innerHTML = `<p style="color:red;padding:20px;">Error: ${err.message}</p>`;
    }
}

// ─── Movie Detail Modal ───────────────────────────────────────────────────────

function parseField(value) {
    if (!value) return null;
    if (typeof value === 'string') {
        try { return JSON.parse(value); } catch { return null; }
    }
    return value;
}

function formatMoney(n) {
    if (!n) return null;
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`;
    return `$${n.toLocaleString()}`;
}

function detailItem(label, value) {
    if (!value && value !== 0) return '';
    return `
        <div class="movie-detail-item">
            <div class="movie-detail-label">${label}</div>
            <div class="movie-detail-value">${value}</div>
        </div>`;
}

async function viewMovieDetail(id) {
    openMovieModal(`
        <div style="display:flex;align-items:center;justify-content:center;
                    height:300px;color:#555;font-size:0.9rem;background:#0f1117;border-radius:1.5rem;">
            Loading…
        </div>
    `);

    try {
        const m = await apiFetch(`/movies/${id}`);

        const genres              = parseField(m.genres);
        const interests           = parseField(m.interests);
        const spokenLanguages     = parseField(m.spokenLanguages);
        const productionCompanies = parseField(m.productionCompanies);
        const filmingLocations    = parseField(m.filmingLocations);
        const thumbnails          = parseField(m.thumbnails);
        const externalLinks       = parseField(m.externalLinks);

        const tagList = (arr, key) => {
            if (!arr || !arr.length) return '';
            return arr.map(item => {
                const label = typeof item === 'string'
                    ? item
                    : (item[key] || item.name || item.text || JSON.stringify(item));
                return `<span class="movie-tag">${escapeHtml(String(label))}</span>`;
            }).join('');
        };

        const thumbsHtml = thumbnails && thumbnails.length
            ? `<div>
                <div class="movie-section-title">Gallery</div>
                <div class="movie-thumbnails">
                    ${thumbnails.map(t => `
                        <div class="movie-thumbnail">
                            <img src="${escapeHtml(t.url)}" alt="thumbnail" loading="lazy"
                                 onerror="this.parentElement.style.display='none'">
                        </div>`).join('')}
                </div></div>` : '';

        const companiesHtml = productionCompanies && productionCompanies.length
            ? `<div>
                <div class="movie-section-title">Production Companies</div>
                <div class="movie-companies">
                    ${productionCompanies.map(c =>
                        `<span class="movie-company">${escapeHtml(c.name || String(c))}</span>`
                    ).join('')}
                </div></div>` : '';

        const genresTagsHtml = (genres && genres.length) || (interests && interests.length)
            ? `<div>
                <div class="movie-section-title">Genres & Interests</div>
                <div class="movie-tags">
                    ${tagList(genres,    'name')}
                    ${tagList(interests, 'name')}
                </div></div>` : '';

        const langsHtml = spokenLanguages && spokenLanguages.length
            ? `<div>
                <div class="movie-section-title">Languages</div>
                <div class="movie-tags">${tagList(spokenLanguages, 'text')}</div>
               </div>` : '';

        const locationsHtml = filmingLocations && filmingLocations.length
            ? `<div>
                <div class="movie-section-title">Filming Locations</div>
                <div class="movie-tags">${tagList(filmingLocations, 'text')}</div>
               </div>` : '';

        const linksHtml = externalLinks && externalLinks.length
            ? `<div>
                <div class="movie-section-title">External Links</div>
                <div class="movie-tags">
                    ${externalLinks.map(l =>
                        `<a href="${escapeHtml(l.url || l)}" target="_blank" rel="noopener"
                            class="movie-tag" style="color:#60a5fa;text-decoration:none;">
                            ${escapeHtml(l.label || l.url || String(l))}
                         </a>`).join('')}
                </div></div>` : '';

        const yearRange = m.startYear
            ? (m.endYear ? `${m.startYear}–${m.endYear}`
               : `${m.startYear}${m.type === 'tvSeries' ? '–present' : ''}`)
            : null;

        const typeLabel = {
            movie: 'Movie', tvSeries: 'TV Series', tvMovie: 'TV Movie',
            short: 'Short', tvMiniSeries: 'Mini-Series', tvSpecial: 'Special',
            tvEpisode: 'Episode', video: 'Video'
        }[m.type] || m.type || 'Unknown';

        const posterHtml = m.primaryImage
            ? `<img src="${escapeHtml(m.primaryImage)}" alt="${escapeHtml(m.primaryTitle)}"
                    onerror="this.parentElement.innerHTML='<div class=\\'no-image\\'>🎬<span>No Image</span></div>'">`
            : `<div class="no-image">🎬<span>No Image</span></div>`;

        const html = `
            <div class="movie-hero">
                <div class="movie-hero-poster">${posterHtml}</div>
                <div class="movie-hero-info">
                    ${m.type ? `<div class="movie-type-badge">${typeLabel}</div>` : ''}
                    <div class="movie-title-main">${escapeHtml(m.primaryTitle)}</div>
                    ${m.originalTitle && m.originalTitle !== m.primaryTitle
                        ? `<div class="movie-original-title">${escapeHtml(m.originalTitle)}</div>` : ''}
                    <div class="movie-meta-row">
                        ${yearRange        ? `<span class="movie-meta-pill"><span class="icon">📅</span>${yearRange}</span>` : ''}
                        ${m.runtimeMinutes ? `<span class="movie-meta-pill"><span class="icon">⏱</span>${m.runtimeMinutes} min</span>` : ''}
                        ${m.contentRating  ? `<span class="movie-meta-pill"><span class="icon">🔞</span>${escapeHtml(m.contentRating)}</span>` : ''}
                        ${m.releaseDate    ? `<span class="movie-meta-pill"><span class="icon">🗓</span>${m.releaseDate}</span>` : ''}
                        ${m.isAdult        ? `<span class="movie-meta-pill" style="color:#f87171;">18+</span>` : ''}
                    </div>
                    <div class="movie-rating-block">
                        ${m.averageRating ? `<div class="movie-rating-star">⭐ ${m.averageRating}</div>` : ''}
                        ${m.metascore     ? `<div class="movie-metascore">${m.metascore}</div>` : ''}
                        ${m.numVotes      ? `<span class="movie-votes">${Number(m.numVotes).toLocaleString()} votes</span>` : ''}
                    </div>
                    ${m.url ? `<div style="margin-top:0.5rem">
                        <a class="movie-imdb-link" href="${escapeHtml(m.url)}" target="_blank" rel="noopener">
                            IMDb ↗
                        </a></div>` : ''}
                </div>
                <button class="movie-close-btn" id="modal-close-btn">✕</button>
            </div>

            <div class="movie-body">
                ${m.description ? `<p class="movie-description">${escapeHtml(m.description)}</p><hr class="movie-divider">` : ''}

                <div class="movie-details-grid">
                    ${detailItem('Budget',         formatMoney(m.budget))}
                    ${detailItem('Box Office',     formatMoney(m.grossWorldwide))}
                    ${detailItem('Start Year',     m.startYear)}
                    ${detailItem('End Year',       m.endYear)}
                    ${detailItem('Runtime',        m.runtimeMinutes ? m.runtimeMinutes + ' min' : null)}
                    ${detailItem('Content Rating', m.contentRating)}
                    ${detailItem('Metascore',      m.metascore)}
                    ${detailItem('Release Date',   m.releaseDate)}
                </div>

                ${genresTagsHtml ? `<hr class="movie-divider">${genresTagsHtml}` : ''}
                ${langsHtml      ? `<hr class="movie-divider">${langsHtml}` : ''}
                ${locationsHtml  ? `<hr class="movie-divider">${locationsHtml}` : ''}
                ${companiesHtml  ? `<hr class="movie-divider">${companiesHtml}` : ''}
                ${linksHtml      ? `<hr class="movie-divider">${linksHtml}` : ''}
                ${thumbsHtml     ? `<hr class="movie-divider">${thumbsHtml}` : ''}
            </div>
        `;

        openMovieModal(html);
        document.getElementById('modal-close-btn').onclick = closeMovieModal;

    } catch (err) {
        openMovieModal(`
            <div style="padding:2rem;color:#f87171;background:#0f1117;border-radius:1.5rem;">
                Could not load movie details: ${escapeHtml(err.message)}
            </div>
        `);
    }
}

// ─── Modal helpers ────────────────────────────────────────────────────────────

function openMovieModal(innerHtml) {
    let overlay = document.getElementById('movie-modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'movie-modal-overlay';
        overlay.className = 'movie-modal-overlay';
        overlay.innerHTML = `<div class="movie-modal" id="movie-modal-inner"></div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeMovieModal(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMovieModal(); });
    }
    document.getElementById('movie-modal-inner').innerHTML = innerHtml;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeMovieModal() {
    const overlay = document.getElementById('movie-modal-overlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[m]);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

const savedToken = localStorage.getItem('token');
if (savedToken) {
    token = savedToken;
    currentUser.is_admin = localStorage.getItem('is_admin') === 'true';
    showDashboard();
}