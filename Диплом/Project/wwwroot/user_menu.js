// Общий скрипт для отображения пользователя, меню выхода и переключения темы на всех страницах

// Определяем стартовую тему как можно раньше, чтобы избежать моргания при загрузке
const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
const savedTheme = localStorage.getItem('theme');
const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
document.documentElement.setAttribute('data-theme', initialTheme);

document.addEventListener("DOMContentLoaded", () => {
    // Проверка авторизации
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Если нет токена или пользователя - перенаправляем на логин
    // (кроме страниц login и reg)
    const currentPage = window.location.pathname.split('/').pop();
    if (!token || !user.username) {
        if (currentPage !== 'login.html' && currentPage !== 'reg.html') {
            window.location.href = "login.html";
            return;
        }
    }

    // Инициализация меню пользователя
    setupUserMenu(user);

    // Тема
    injectThemeStyles();
    createThemeToggleButton();
    applyTheme(initialTheme, false);

    // Поиск по страницам (навигация)
    createSidebarSearch();
});

// Настройка меню пользователя
function setupUserMenu(user) {
    // Отображаем имя пользователя
    const userElement = document.getElementById('currentUser');
    if (userElement) {
        userElement.textContent = user.username || 'Гость';
    }

    // Настраиваем меню выхода
    const menu = document.getElementById("logoutMenu");
    const userInfo = document.querySelector(".user-info");

    if (userInfo && menu) {
        userInfo.addEventListener("click", (e) => {
            e.stopPropagation();
            menu.style.display = menu.style.display === "block" ? "none" : "block";
        });

        // Закрываем меню при клике вне его
        document.addEventListener('click', () => {
            menu.style.display = 'none';
        });
    }

    // Обработчик выхода
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", logout);
    }
}

// Функция выхода
function logout() {
    // Удаляем все данные авторизации
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('username');

    // Перенаправляем на страницу логина
    window.location.href = 'login.html';
}

// ======== Переключение темы ======== //

function applyTheme(theme, persist = true) {
    document.documentElement.setAttribute('data-theme', theme);
    if (persist) {
        localStorage.setItem('theme', theme);
    }
    updateThemeToggleContent(theme);
}

function createThemeToggleButton() {
    if (document.getElementById('themeToggle')) return;

    const button = document.createElement('button');
    button.id = 'themeToggle';
    button.type = 'button';
    button.className = 'theme-toggle';
    button.setAttribute('aria-label', 'Переключить тему');
    button.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
    });

    document.body.appendChild(button);
    updateThemeToggleContent(document.documentElement.getAttribute('data-theme') || 'light');
}

function updateThemeToggleContent(theme) {
    const button = document.getElementById('themeToggle');
    if (!button) return;

    const isDark = theme === 'dark';
    const icon = isDark ? '🌙' : '☀️';
    const label = isDark ? 'Тёмная тема' : 'Светлая тема';

    button.innerHTML = `<span class="icon">${icon}</span><span class="label">${label}</span>`;
}function injectThemeStyles() {
    if (document.getElementById('themeStyles')) return;

    const style = document.createElement('style');
    style.id = 'themeStyles';
    style.textContent = `
    :root {
        --bg-main: #f5f7fb;
        --bg-surface: #ffffff;
        --bg-subtle: #f0f4fa;
        --bg-muted: #fafbfe;
        --text-main: #1f2933;
        --text-muted: #52616f;
        --accent: #0a4da3;
        --accent-strong: #083a7a;
        --border: #e0e4ec;
        --hover: #e9f1ff;
        --table-header: #e8eef9;
        --input-bg: #fdfdff;
        --shadow-soft: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    :root[data-theme="dark"] {
        --bg-main: #0f172a;
        --bg-surface: #111827;
        --bg-subtle: #1f2937;
        --bg-muted: #0b1626;
        --text-main: #e5e7eb;
        --text-muted: #cbd5e1;
        --accent: #8cb8ff;
        --accent-strong: #b7d1ff;
        --border: #1f2937;
        --hover: #1b2b44;
        --table-header: #1f2a3d;
        --input-bg: #0b1626;
        --shadow-soft: 0 12px 30px rgba(0, 0, 0, 0.4);
    }

    body {
        background: var(--bg-main) !important;
        color: var(--text-main) !important;
    }

    .sidebar {
        background: var(--bg-surface) !important;
        border-right: 1px solid var(--border) !important;
        box-shadow: var(--shadow-soft) !important;
        color: var(--text-main) !important;
    }

    .sidebar h1 {
        color: var(--accent) !important;
    }

    .nav-item > a {
        color: var(--text-main) !important;
    }

    .nav-item > a .arrow {
        color: var(--text-muted) !important;
    }

    .nav-item > a:hover,
    .nav-item > a.active {
        background-color: var(--hover) !important;
        border-left-color: var(--accent) !important;
        color: var(--accent) !important;
    }

    .submenu {
        background: var(--bg-surface) !important;
        border-left: 4px solid var(--accent) !important;
        box-shadow: var(--shadow-soft) !important;
    }

    .submenu a {
        color: var(--text-main) !important;
    }

    .submenu a:hover,
    .submenu a.active {
        background: var(--hover) !important;
        color: var(--accent) !important;
    }

    .main {
        background: var(--bg-main) !important;
    }

    .header h2,
    .section-title {
        color: var(--accent) !important;
    }

    .current-time {
        background: var(--bg-subtle) !important;
        color: var(--text-muted) !important;
        border: 1px solid var(--border) !important;
    }

    .user-info {
        color: var(--text-main) !important;
    }

    .logout-menu {
        background: var(--bg-surface) !important;
        border: 1px solid var(--border) !important;
        box-shadow: var(--shadow-soft) !important;
    }

    .cards .card,
    .card,
    .chart-container,
    .table-container,
    .modal-content,
    .auth-container {
        background: var(--bg-surface) !important;
        color: var(--text-main) !important;
        border: 1px solid var(--border) !important;
        box-shadow: var(--shadow-soft) !important;
    }

    .card h3,
    .form-group label {
        color: var(--text-muted) !important;
    }

    .card-value,
    .card-icon {
        color: var(--accent) !important;
    }

    table {
        background: var(--bg-surface) !important;
    }

    th {
        background-color: var(--table-header) !important;
    }

    :root[data-theme="dark"] th {
        color: var(--text-main) !important;
    }

    td, th {
        color: var(--text-main) !important;
        border-color: var(--border) !important;
    }

    tr:nth-child(even):not(.group-row):not(.group-item) {
        background-color: var(--bg-muted) !important;
    }

    tr:hover:not(.group-row):not(.group-item) {
        background-color: var(--hover) !important;
    }

    .controls input,
    .controls select,
    .controls textarea,
    .filters input,
    .filters select,
    .filters textarea {
        background: var(--input-bg) !important;
        color: var(--text-main) !important;
        border: 1px solid var(--border) !important;
    }

    .controls button {
        background: var(--accent) !important;
        color: #fff !important;
        border: none !important;
    }

    .controls button.delete {
        background: #d9534f !important;
        color: #fff !important;
        border: none !important;
    }

    .controls button.delete:hover {
        background: #b02a2a !important;
    }

    .modal-content {
        background: var(--bg-surface) !important;
        color: var(--text-main) !important;
        border: 1px solid var(--border) !important;
    }

    .modal-header {
        background: var(--accent) !important;
        color: #ffffff !important;
        border-bottom: 1px solid var(--border) !important;
    }

    .modal-footer {
        background: var(--bg-subtle) !important;
        border-top: 1px solid var(--border) !important;
    }

    input,
    select,
    textarea {
        background: var(--input-bg) !important;
        color: var(--text-main) !important;
        border: 1px solid var(--border) !important;
    }

    input::placeholder,
    textarea::placeholder {
        color: var(--text-muted) !important;
    }

    .modal {
        background: rgba(0, 0, 0, 0.4) !important;
    }

    :root[data-theme="dark"] .modal {
        background: rgba(0, 0, 0, 0.55) !important;
    }

    .theme-toggle {
        position: fixed;
        left: 22px;
        bottom: 22px;
        z-index: 1200;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 12px 14px;
        border-radius: 999px;
        border: none;
        cursor: pointer;
        background: linear-gradient(135deg, var(--accent), var(--accent-strong));
        color: #ffffff;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.18);
        font-weight: 600;
        letter-spacing: 0.2px;
        transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.2s ease;
    }

    .theme-toggle:hover {
        transform: translateY(-1px);
        box-shadow: 0 14px 28px rgba(0, 0, 0, 0.24);
    }

    .theme-toggle:active {
        transform: translateY(0);
    }

    .theme-toggle .icon {
        font-size: 18px;
        line-height: 1;
    }

    .theme-toggle .label {
        font-size: 13px;
        line-height: 1;
    }

    :root[data-theme="dark"] .theme-toggle {
        background: linear-gradient(135deg, #1f2937, #0f172a);
        color: #f8fafc;
        border: 1px solid #1e293b;
    }

    /* Поиск по страницам в сайдбаре */
    .sidebar-search {
        width: 100%;
        padding: 0 16px 12px;
        box-sizing: border-box;
    }

    .sidebar-search input {
        width: 100%;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: var(--input-bg);
        color: var(--text-main);
        font-size: 14px;
        outline: none;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
        box-shadow: inset 0 1px 2px rgba(0,0,0,0.04);
    }

    .sidebar-search input::placeholder {
        color: var(--text-muted);
    }

    .sidebar-search input:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(10, 77, 163, 0.12);
    }

    /* Темные подменю */
    .nav-item:hover > .submenu {
        background: var(--bg-surface) !important;
        box-shadow: var(--shadow-soft) !important;
        display: flex !important;
    }
    `;

    document.head.appendChild(style);
}

// Добавление поиска по навигации и фильтрация пунктов
function createSidebarSearch() {
    const sidebar = document.querySelector('.sidebar');
    const nav = document.querySelector('.nav');
    if (!sidebar || !nav || document.querySelector('.sidebar-search')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'sidebar-search';

    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Поиск по страницам...';
    input.setAttribute('autocomplete', 'off');

    wrapper.appendChild(input);
    sidebar.insertBefore(wrapper, nav);

    input.addEventListener('input', () => filterNavigation(input.value));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            input.value = '';
            filterNavigation('');
        }
    });
}

function filterNavigation(rawQuery) {
    const query = (rawQuery || '').trim().toLowerCase();
    const navItems = Array.from(document.querySelectorAll('.nav-item'));

    navItems.forEach((item) => {
        const mainLink = item.querySelector(':scope > a');
        const submenu = item.querySelector('.submenu');
        const subLinks = submenu ? Array.from(submenu.querySelectorAll('a')) : [];

        if (!query) {
            // Сброс фильтра
            item.style.display = '';
            if (submenu) submenu.style.display = '';
            subLinks.forEach((a) => (a.style.display = ''));
            return;
        }

        const mainMatch = mainLink && mainLink.textContent.toLowerCase().includes(query);
        let subMatch = false;
        subLinks.forEach((a) => {
            const match = a.textContent.toLowerCase().includes(query);
            a.style.display = match ? '' : 'none';
            if (match) subMatch = true;
        });

        const hasMatch = mainMatch || subMatch;
        item.style.display = hasMatch ? '' : 'none';
        if (submenu) {
            submenu.style.display = '';
        }

        // Если совпал родительский пункт, показываем все подпункты;
        // если совпали только подпункты — оставляем фильтрацию по совпадениям.
        if (mainMatch) {
            subLinks.forEach((a) => (a.style.display = ''));
        }
    });
}
