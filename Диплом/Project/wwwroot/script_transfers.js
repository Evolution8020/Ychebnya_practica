// =====================================================
// СПИСОК ПЕРЕМЕЩЕНИЙ
// =====================================================

let transfers = [];
let sortColumn = 1;
let sortDirection = 'desc';
let selectedTransferId = null;

document.addEventListener('DOMContentLoaded', () => {
    loadTransfers();
    
    // Обработчик кнопки редактирования
    document.getElementById('editBtn').addEventListener('click', () => {
        if (selectedTransferId) {
            editTransfer(selectedTransferId);
        } else {
            alert('Выберите перемещение для редактирования');
        }
    });
    
    // Обработчик кнопки удаления
    document.getElementById('deleteBtn').addEventListener('click', () => {
        if (selectedTransferId) {
            deleteTransfer(selectedTransferId);
        } else {
            alert('Выберите перемещение для удаления');
        }
    });
    
    // Обработчик поиска
    document.getElementById('searchInput').addEventListener('input', () => {
        filterTable();
    });
});

// =================== ЗАГРУЗКА ДАННЫХ ===================
async function loadTransfers() {
    try {
        const response = await fetch('/api/transfers');
        if (!response.ok) throw new Error('Ошибка загрузки');
        
        transfers = await response.json();
        renderTable();
    } catch (error) {
        console.error('Ошибка загрузки перемещений:', error);
        showEmptyMessage('Не удалось загрузить данные');
    }
}

// =================== ОТРИСОВКА ТАБЛИЦЫ ===================
function renderTable() {
    const tbody = document.getElementById('transfersBody');
    
    if (transfers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Перемещения не найдены</td></tr>';
        return;
    }

    // Сортировка
    const sorted = [...transfers].sort((a, b) => {
        let valA, valB;
        
        switch (sortColumn) {
            case 0: valA = a.doc_number || ''; valB = b.doc_number || ''; break;
            case 1: valA = new Date(a.date); valB = new Date(b.date); break;
            case 2: valA = a.warehouseFromName || ''; valB = b.warehouseFromName || ''; break;
            case 3: valA = a.warehouseToName || ''; valB = b.warehouseToName || ''; break;
            case 4: valA = a.totalQuantity || 0; valB = b.totalQuantity || 0; break;
            case 5: valA = a.responsible || ''; valB = b.responsible || ''; break;
            default: return 0;
        }
        
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    tbody.innerHTML = sorted.map(t => `
        <tr data-id="${t.id}">
            <td><strong>${escapeHtml(t.doc_number || '—')}</strong></td>
            <td>${formatDate(t.date)}</td>
            <td>${escapeHtml(t.warehouseFromName || '—')}</td>
            <td>${escapeHtml(t.warehouseToName || '—')}</td>
            <td>${t.totalQuantity || 0}</td>
            <td>${escapeHtml(t.responsible || '—')}</td>
        </tr>
    `).join('');
    
    // Добавляем обработчики клика на строки
    tbody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('click', function() {
            // Снимаем выделение со всех строк
            tbody.querySelectorAll('tr').forEach(tr => tr.classList.remove('selected'));
            
            // Выделяем текущую строку
            this.classList.add('selected');
            
            // Сохраняем ID выбранного перемещения
            selectedTransferId = this.dataset.id;
        });
    });
}

// =================== СОРТИРОВКА ===================
function sortTable(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }
    
    // Обновляем стрелки
    document.querySelectorAll('.sort-arrow').forEach((arrow, index) => {
        if (index === column) {
            arrow.textContent = sortDirection === 'asc' ? '▲' : '▼';
        } else {
            arrow.textContent = '▲';
        }
    });
    
    renderTable();
}

// =================== УДАЛЕНИЕ ===================
async function deleteTransfer(id) {
    if (!id) {
        alert('Выберите перемещение для удаления');
        return;
    }
    
    if (!confirm('Вы уверены, что хотите удалить это перемещение?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/transfers/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Ошибка удаления');
        
        selectedTransferId = null;
        loadTransfers();
    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('Ошибка удаления перемещения');
    }
}

// =================== ПОИСК ===================
function filterTable() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const tbody = document.getElementById('transfersBody');
    
    // Фильтруем строки таблицы
    tbody.querySelectorAll('tr').forEach(row => {
        const match = Array.from(row.children).some(td => 
            td.innerText.toLowerCase().includes(query)
        );
        row.style.display = match ? '' : 'none';
    });
}

// =================== РЕДАКТИРОВАНИЕ ===================
function editTransfer(id) {
    if (!id) {
        alert('Выберите перемещение для редактирования');
        return;
    }
    window.location.href = `edit_transfer.html?id=${id}`;
}

// =================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===================
function formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showEmptyMessage(message) {
    document.getElementById('transfersBody').innerHTML = `
        <tr><td colspan="7" class="empty-row">${message}</td></tr>
    `;
}

