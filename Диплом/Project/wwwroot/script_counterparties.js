// =====================================================
// УПРАВЛЕНИЕ КОНТРАГЕНТАМИ
// =====================================================

let counterparties = [];
let editingId = null;

document.addEventListener('DOMContentLoaded', () => {
    loadCounterparties();
    
    document.getElementById('counterpartyForm').addEventListener('submit', saveCounterparty);
});

// =================== ЗАГРУЗКА ДАННЫХ ===================
async function loadCounterparties() {
    try {
        const response = await fetch('/api/counterparties');
        if (!response.ok) throw new Error('Ошибка загрузки');
        
        counterparties = await response.json();
        renderTable();
    } catch (error) {
        console.error('Ошибка загрузки контрагентов:', error);
        showEmptyMessage('Не удалось загрузить данные');
    }
}

// =================== ОТРИСОВКА ТАБЛИЦЫ ===================
function renderTable() {
    const tbody = document.getElementById('counterpartiesTable');
    
    if (counterparties.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-message">Контрагенты не найдены</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = counterparties.map(cp => `
        <tr>
            <td>${cp.id}</td>
            <td>${escapeHtml(cp.name)}</td>
            <td>${escapeHtml(cp.inn || '—')}</td>
            <td>${escapeHtml(cp.contact || '—')}</td>
            <td class="actions">
                <button class="btn-edit" onclick="editCounterparty(${cp.id})">Изменить</button>
                <button class="btn-delete" onclick="deleteCounterparty(${cp.id})">Удалить</button>
            </td>
        </tr>
    `).join('');
}

// =================== МОДАЛЬНОЕ ОКНО ===================
function openModal(isEdit = false) {
    document.getElementById('modalOverlay').style.display = 'block';
    document.getElementById('counterpartyModal').style.display = 'block';
    document.getElementById('modalTitle').textContent = isEdit ? 'Редактировать контрагента' : 'Добавить контрагента';
    
    if (!isEdit) {
        document.getElementById('counterpartyForm').reset();
        document.getElementById('counterpartyId').value = '';
        editingId = null;
    }
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.getElementById('counterpartyModal').style.display = 'none';
    document.getElementById('counterpartyForm').reset();
    editingId = null;
}

// =================== РЕДАКТИРОВАНИЕ ===================
function editCounterparty(id) {
    const cp = counterparties.find(c => c.id === id);
    if (!cp) return;
    
    editingId = id;
    
    document.getElementById('counterpartyId').value = cp.id;
    document.getElementById('name').value = cp.name || '';
    document.getElementById('inn').value = cp.inn || '';
    document.getElementById('contact').value = cp.contact || '';
    
    openModal(true);
}

// =================== СОХРАНЕНИЕ ===================
async function saveCounterparty(e) {
    e.preventDefault();
    
    const id = document.getElementById('counterpartyId').value;
    const name = document.getElementById('name').value.trim();
    const inn = document.getElementById('inn').value.trim();
    const contact = document.getElementById('contact').value.trim();
    
    if (!name) {
        alert('Введите наименование контрагента');
        return;
    }
    
    // Валидация ИНН (10 или 12 цифр)
    if (inn && !/^\d{10}$|^\d{12}$/.test(inn)) {
        alert('ИНН должен содержать 10 или 12 цифр');
        return;
    }
    
    const cpData = {
        name: name,
        inn: inn || null,
        contact: contact || null
    };
    
    try {
        let response;
        
        if (id) {
            // Обновление
            response = await fetch(`/api/counterparties/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cpData)
            });
        } else {
            // Создание
            response = await fetch('/api/counterparties', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cpData)
            });
        }
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || 'Ошибка сохранения');
        }
        
        closeModal();
        loadCounterparties();
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        alert('Ошибка сохранения: ' + error.message);
    }
}

// =================== УДАЛЕНИЕ ===================
async function deleteCounterparty(id) {
    if (!confirm('Вы уверены, что хотите удалить этого контрагента?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/counterparties/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Ошибка удаления');
        
        loadCounterparties();
    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('Ошибка удаления контрагента. Возможно, он используется в документах поступления.');
    }
}

// =================== ПОИСК ===================
function filterTable() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    
    const filtered = counterparties.filter(cp => 
        (cp.name && cp.name.toLowerCase().includes(query)) ||
        (cp.inn && cp.inn.includes(query))
    );
    
    const tbody = document.getElementById('counterpartiesTable');
    
    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-message">Ничего не найдено</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filtered.map(cp => `
        <tr>
            <td>${cp.id}</td>
            <td>${escapeHtml(cp.name)}</td>
            <td>${escapeHtml(cp.inn || '—')}</td>
            <td>${escapeHtml(cp.contact || '—')}</td>
            <td class="actions">
                <button class="btn-edit" onclick="editCounterparty(${cp.id})">Изменить</button>
                <button class="btn-delete" onclick="deleteCounterparty(${cp.id})">Удалить</button>
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
    document.getElementById('counterpartiesTable').innerHTML = `
        <tr>
            <td colspan="5" class="empty-message">${message}</td>
        </tr>
    `;
}

