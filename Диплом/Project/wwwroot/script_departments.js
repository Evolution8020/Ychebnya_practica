// =====================================================
// УПРАВЛЕНИЕ ПОДРАЗДЕЛЕНИЯМИ
// =====================================================

let departments = [];
let editingId = null;

document.addEventListener('DOMContentLoaded', () => {
    loadDepartments();
    
    document.getElementById('departmentForm').addEventListener('submit', saveDepartment);
});

// =================== ЗАГРУЗКА ДАННЫХ ===================
async function loadDepartments() {
    try {
        const response = await fetch('/api/departments');
        if (!response.ok) throw new Error('Ошибка загрузки');
        
        departments = await response.json();
        renderTable();
        updateParentSelect();
    } catch (error) {
        console.error('Ошибка загрузки подразделений:', error);
        showEmptyMessage('Не удалось загрузить данные');
    }
}

// =================== ОТРИСОВКА ТАБЛИЦЫ ===================
function renderTable() {
    const tbody = document.getElementById('departmentsTable');
    
    if (departments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-message">Подразделения не найдены</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = departments.map(dept => {
        const parent = dept.parent_id ? departments.find(d => d.id === dept.parent_id) : null;
        return `
            <tr>
                <td>${dept.id}</td>
                <td>${escapeHtml(dept.name)}</td>
                <td>${parent ? escapeHtml(parent.name) : '—'}</td>
                <td class="actions">
                    <button class="btn-edit" onclick="editDepartment(${dept.id})">Изменить</button>
                    <button class="btn-delete" onclick="deleteDepartment(${dept.id})">Удалить</button>
                </td>
            </tr>
        `;
    }).join('');
}

// =================== ОБНОВЛЕНИЕ СЕЛЕКТА РОДИТЕЛЯ ===================
function updateParentSelect(excludeId = null) {
    const select = document.getElementById('parentId');
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">— Нет (корневое) —</option>';
    
    departments
        .filter(d => d.id !== excludeId) // Исключаем текущее подразделение
        .forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.id;
            option.textContent = dept.name;
            select.appendChild(option);
        });
    
    // Восстанавливаем выбранное значение
    if (currentValue) {
        select.value = currentValue;
    }
}

// =================== МОДАЛЬНОЕ ОКНО ===================
function openModal(isEdit = false) {
    document.getElementById('modalOverlay').style.display = 'block';
    document.getElementById('departmentModal').style.display = 'block';
    document.getElementById('modalTitle').textContent = isEdit ? 'Редактировать подразделение' : 'Добавить подразделение';
    
    if (!isEdit) {
        document.getElementById('departmentForm').reset();
        document.getElementById('departmentId').value = '';
        updateParentSelect();
        editingId = null;
    }
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.getElementById('departmentModal').style.display = 'none';
    document.getElementById('departmentForm').reset();
    editingId = null;
}

// =================== РЕДАКТИРОВАНИЕ ===================
function editDepartment(id) {
    const dept = departments.find(d => d.id === id);
    if (!dept) return;
    
    editingId = id;
    
    document.getElementById('departmentId').value = dept.id;
    document.getElementById('name').value = dept.name || '';
    
    // Обновляем селект, исключая текущее подразделение
    updateParentSelect(id);
    document.getElementById('parentId').value = dept.parent_id || '';
    
    openModal(true);
}

// =================== СОХРАНЕНИЕ ===================
async function saveDepartment(e) {
    e.preventDefault();
    
    const id = document.getElementById('departmentId').value;
    const name = document.getElementById('name').value.trim();
    const parentId = document.getElementById('parentId').value;
    
    if (!name) {
        alert('Введите название подразделения');
        return;
    }
    
    const deptData = {
        name: name,
        parent_id: parentId ? parseInt(parentId) : null
    };
    
    try {
        let response;
        
        if (id) {
            // Обновление
            response = await fetch(`/api/departments/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(deptData)
            });
        } else {
            // Создание
            response = await fetch('/api/departments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(deptData)
            });
        }
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || 'Ошибка сохранения');
        }
        
        closeModal();
        loadDepartments();
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        alert('Ошибка сохранения: ' + error.message);
    }
}

// =================== УДАЛЕНИЕ ===================
async function deleteDepartment(id) {
    // Проверяем, есть ли дочерние подразделения
    const hasChildren = departments.some(d => d.parent_id === id);
    if (hasChildren) {
        alert('Нельзя удалить подразделение, у которого есть дочерние подразделения');
        return;
    }
    
    if (!confirm('Вы уверены, что хотите удалить это подразделение?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/departments/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Ошибка удаления');
        
        loadDepartments();
    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('Ошибка удаления подразделения. Возможно, оно используется в других документах.');
    }
}

// =================== ПОИСК ===================
function filterTable() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    
    const filtered = departments.filter(d => 
        d.name && d.name.toLowerCase().includes(query)
    );
    
    const tbody = document.getElementById('departmentsTable');
    
    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-message">Ничего не найдено</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filtered.map(dept => {
        const parent = dept.parent_id ? departments.find(d => d.id === dept.parent_id) : null;
        return `
            <tr>
                <td>${dept.id}</td>
                <td>${escapeHtml(dept.name)}</td>
                <td>${parent ? escapeHtml(parent.name) : '—'}</td>
                <td class="actions">
                    <button class="btn-edit" onclick="editDepartment(${dept.id})">Изменить</button>
                    <button class="btn-delete" onclick="deleteDepartment(${dept.id})">Удалить</button>
                </td>
            </tr>
        `;
    }).join('');
}

// =================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showEmptyMessage(message) {
    document.getElementById('departmentsTable').innerHTML = `
        <tr>
            <td colspan="4" class="empty-message">${message}</td>
        </tr>
    `;
}

