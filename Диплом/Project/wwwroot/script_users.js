// =====================================================
// УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ
// =====================================================

let users = [];
let editingUsername = null;

document.addEventListener('DOMContentLoaded', () => {
    loadUsers();
    
    document.getElementById('userForm').addEventListener('submit', saveUser);
});

// =================== ЗАГРУЗКА ДАННЫХ ===================
async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        if (!response.ok) throw new Error('Ошибка загрузки');
        
        users = await response.json();
        renderTable();
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        showEmptyMessage('Не удалось загрузить данные');
    }
}

// =================== ОТРИСОВКА ТАБЛИЦЫ ===================
function renderTable() {
    const tbody = document.getElementById('usersTable');
    
    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-message">Пользователи не найдены</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${escapeHtml(user.username)}</td>
            <td>${escapeHtml(user.full_name || '—')}</td>
            <td>${getRoleBadge(user.role)}</td>
            <td class="actions">
                <button class="btn-edit" onclick="editUser('${escapeHtml(user.username)}')">Изменить</button>
                <button class="btn-delete" onclick="deleteUser('${escapeHtml(user.username)}')">Удалить</button>
            </td>
        </tr>
    `).join('');
}

// =================== ПОЛУЧЕНИЕ BADGE ДЛЯ РОЛИ ===================
function getRoleBadge(role) {
    const roles = {
        'admin': { text: 'Администратор', class: 'badge-admin' },
        'user': { text: 'Пользователь', class: 'badge-user' },
        'viewer': { text: 'Только просмотр', class: 'badge-viewer' }
    };
    
    const r = roles[role] || { text: role || 'Не указана', class: 'badge-viewer' };
    return `<span class="badge ${r.class}">${r.text}</span>`;
}

// =================== МОДАЛЬНОЕ ОКНО ===================
function openModal(isEdit = false) {
    document.getElementById('modalOverlay').style.display = 'block';
    document.getElementById('userModal').style.display = 'block';
    document.getElementById('modalTitle').textContent = isEdit ? 'Редактировать пользователя' : 'Добавить пользователя';
    
    if (!isEdit) {
        document.getElementById('userForm').reset();
        document.getElementById('username').readOnly = false;
        document.getElementById('password').placeholder = '';
        document.getElementById('password').required = true;
        editingUsername = null;
    }
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.getElementById('userModal').style.display = 'none';
    document.getElementById('userForm').reset();
    document.getElementById('username').readOnly = false;
    editingUsername = null;
}

// =================== РЕДАКТИРОВАНИЕ ===================
function editUser(username) {
    const user = users.find(u => u.username === username);
    if (!user) return;
    
    editingUsername = username;
    
    document.getElementById('username').value = user.username || '';
    document.getElementById('username').readOnly = true; // Логин нельзя изменить
    document.getElementById('password').value = ''; // Не показываем пароль
    document.getElementById('password').placeholder = 'Оставьте пустым, чтобы не менять пароль';
    document.getElementById('password').required = false; // При редактировании пароль необязателен
    document.getElementById('fullName').value = user.full_name || '';
    document.getElementById('role').value = user.role || 'user';
    
    openModal(true);
}

// =================== СОХРАНЕНИЕ ===================
async function saveUser(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const fullName = document.getElementById('fullName').value.trim();
    const role = document.getElementById('role').value;
    
    if (!username) {
        alert('Введите логин');
        return;
    }
    
    // При создании пароль обязателен
    if (!editingUsername && !password) {
        alert('Введите пароль');
        return;
    }
    
    const userData = {
        username: username,
        full_name: fullName,
        role: role
    };
    
    // Добавляем пароль только если он указан
    if (password) {
        userData.password = password;
    }
    
    try {
        let response;
        
        if (editingUsername) {
            // Обновление
            response = await fetch(`/api/users/${editingUsername}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
        } else {
            // Создание
            response = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
        }
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || 'Ошибка сохранения');
        }
        
        closeModal();
        loadUsers();
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        alert('Ошибка сохранения: ' + error.message);
    }
}

// =================== УДАЛЕНИЕ ===================
async function deleteUser(username) {
    // Проверяем, не удаляет ли пользователь сам себя
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (currentUser.username === username) {
        alert('Нельзя удалить собственную учётную запись');
        return;
    }
    
    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${username}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Ошибка удаления');
        
        loadUsers();
    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('Ошибка удаления пользователя');
    }
}

// =================== ПОИСК ===================
function filterTable() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    
    const filtered = users.filter(u => 
        (u.username && u.username.toLowerCase().includes(query)) ||
        (u.full_name && u.full_name.toLowerCase().includes(query))
    );
    
    const tbody = document.getElementById('usersTable');
    
    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-message">Ничего не найдено</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filtered.map(user => `
        <tr>
            <td>${escapeHtml(user.username)}</td>
            <td>${escapeHtml(user.full_name || '—')}</td>
            <td>${getRoleBadge(user.role)}</td>
            <td class="actions">
                <button class="btn-edit" onclick="editUser('${escapeHtml(user.username)}')">Изменить</button>
                <button class="btn-delete" onclick="deleteUser('${escapeHtml(user.username)}')">Удалить</button>
            </td>
        </tr>
    `).join('');
}

// =================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showEmptyMessage(message) {
    document.getElementById('usersTable').innerHTML = `
        <tr>
            <td colspan="4" class="empty-message">${message}</td>
        </tr>
    `;
}

