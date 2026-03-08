// =====================================================
// РЕДАКТИРОВАНИЕ ПЕРЕМЕЩЕНИЯ
// =====================================================

let transferId = null;
let nomenclatures = [];
let warehouses = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Получаем ID из URL
    const urlParams = new URLSearchParams(window.location.search);
    transferId = urlParams.get('id');

    if (!transferId) {
        alert('ID перемещения не указан!');
        window.location.href = 'transfers.html';
        return;
    }

    await loadNomenclatures();
    await loadWarehouses();
    await loadTransferData(transferId);
    
    // Обработчики
    document.getElementById('addPositionBtn').addEventListener('click', addItemRow);
    document.getElementById('updateBtn').addEventListener('click', updateTransfer);
    document.getElementById('deleteBtn').addEventListener('click', deleteTransfer);
    document.getElementById('cancelBtn').addEventListener('click', () => {
        window.location.href = 'transfers.html';
    });
});

// =================== ЗАГРУЗКА СПРАВОЧНИКОВ ===================
async function loadNomenclatures() {
    try {
        const response = await fetch('/api/nomenclatures');
        if (response.ok) {
            nomenclatures = await response.json();
        }
    } catch (error) {
        console.error('Ошибка загрузки номенклатуры:', error);
    }
}

async function loadWarehouses() {
    try {
        const response = await fetch('/api/warehouses');
        if (response.ok) {
            warehouses = await response.json();
            
            const selectFrom = document.getElementById('warehouseFromSelect');
            const selectTo = document.getElementById('warehouseToSelect');
            
            selectFrom.innerHTML = '<option value="">-- Выберите склад --</option>';
            selectTo.innerHTML = '<option value="">-- Выберите склад --</option>';
            
            warehouses.forEach(w => {
                selectFrom.innerHTML += `<option value="${w.id}">${w.name}</option>`;
                selectTo.innerHTML += `<option value="${w.id}">${w.name}</option>`;
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки складов:', error);
    }
}

// =================== ЗАГРУЗКА ДАННЫХ ПЕРЕМЕЩЕНИЯ ===================
async function loadTransferData(id) {
    try {
        const response = await fetch(`/api/transfers/${id}`);
        if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
        
        const transfer = await response.json();
        console.log('Получены данные перемещения:', transfer);
        
        // Обновляем заголовок
        document.getElementById('transferTitle').textContent = transfer.doc_number;
        document.getElementById('transferId').value = transfer.id;
        
        // Заполняем поля формы
        // Правильно парсим дату, извлекая время напрямую из строки без конвертации часовых поясов
        let dateStr = transfer.date;
        
        // Извлекаем дату и время из ISO строки напрямую
        if (typeof dateStr === 'string') {
            if (dateStr.includes('T')) {
                // Разделяем дату и время
                const [datePart, timePart] = dateStr.split('T');
                document.getElementById('transferDate').value = datePart;
                
                // Время больше не используется
            } else {
                // Если дата без времени
                document.getElementById('transferDate').value = dateStr;
            }
        } else {
            // Если дата - объект Date (маловероятно, но на всякий случай)
            const dateObj = new Date(dateStr);
            const year = dateObj.getUTCFullYear();
            const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getUTCDate()).padStart(2, '0');
            document.getElementById('transferDate').value = `${year}-${month}-${day}`;
            
            // Время больше не используется
        }
        
        document.getElementById('docNumber').value = transfer.doc_number;
        document.getElementById('warehouseFromSelect').value = transfer.warehouse_from_id;
        document.getElementById('warehouseToSelect').value = transfer.warehouse_to_id;
        document.getElementById('responsible').value = transfer.responsible;
        document.getElementById('transferComment').value = transfer.comment || '';
        
        // Заполняем таблицу позиций
        if (transfer.items && transfer.items.length > 0) {
            transfer.items.forEach(item => {
                addItemRow({
                    nomenclature_id: item.nomenclature_id,
                    quantity: item.quantity,
                    unit: item.unit
                });
            });
        }
        
    } catch (error) {
        console.error('Ошибка загрузки перемещения:', error);
        alert('Не удалось загрузить данные перемещения: ' + error.message);
        window.location.href = 'transfers.html';
    }
}

// =================== ДОБАВЛЕНИЕ ПОЗИЦИИ ===================
function addItemRow(data = null) {
    const tbody = document.getElementById('itemsTableBody');
    const row = document.createElement('tr');
    row.className = 'item-row';
    
    const optionsHtml = nomenclatures
        .map(n => `<option value="${n.id}" data-unit="${n.base_unit || ''}">${n.name}</option>`)
        .join('');
    
    row.innerHTML = `
        <td>
            <select class="nomenclature-select">
                <option value="">Выберите номенклатуру</option>
                ${optionsHtml}
            </select>
        </td>
        <td><input type="number" class="qty-input" step="0.01" min="0.01" placeholder="0"></td>
        <td><input type="text" class="unit-input" readonly></td>
        <td><button type="button" class="btn-delete">Удалить</button></td>
    `;
    
    tbody.appendChild(row);
    
    const select = row.querySelector('.nomenclature-select');
    const unitInput = row.querySelector('.unit-input');
    
    select.addEventListener('change', () => {
        const option = select.options[select.selectedIndex];
        unitInput.value = option.dataset.unit || '';
    });
    
    row.querySelector('.btn-delete').addEventListener('click', () => row.remove());
    
    // Если переданы данные - заполняем
    if (data) {
        setTimeout(() => {
            select.value = data.nomenclature_id || '';
            row.querySelector('.qty-input').value = data.quantity || '';
            unitInput.value = data.unit || '';
        }, 10);
    }
}

// =================== ОБНОВЛЕНИЕ ПЕРЕМЕЩЕНИЯ ===================
async function updateTransfer() {
    const docNumber = document.getElementById('docNumber').value.trim();
    const transferDate = document.getElementById('transferDate').value;
    const warehouseFromId = parseInt(document.getElementById('warehouseFromSelect').value);
    const warehouseToId = parseInt(document.getElementById('warehouseToSelect').value);
    const responsible = document.getElementById('responsible').value.trim();
    const comment = document.getElementById('transferComment').value.trim();
    
    console.log('Отправляемая дата:', transferDate);
    
    // Валидация
    if (!docNumber || !transferDate || !warehouseFromId || !warehouseToId || !responsible) {
        alert('Заполните все обязательные поля');
        return;
    }
    
    if (warehouseFromId === warehouseToId) {
        alert('Склад отправления и склад назначения должны быть разными');
        return;
    }
    
    // Собираем позиции
    const items = [];
    document.querySelectorAll('#itemsTableBody .item-row').forEach(row => {
        const nomenclatureId = parseInt(row.querySelector('.nomenclature-select').value);
        const quantity = parseFloat(row.querySelector('.qty-input').value);
        
        if (nomenclatureId && quantity > 0) {
            items.push({
                nomenclature_id: nomenclatureId,
                quantity: quantity
            });
        }
    });
    
    if (items.length === 0) {
        alert('Добавьте хотя бы одну позицию');
        return;
    }
    
    const payload = {
        doc_number: docNumber,
        date: transferDate,
        warehouse_from_id: warehouseFromId,
        warehouse_to_id: warehouseToId,
        responsible: responsible,
        comment: comment,
        items: items
    };
    
    try {
        const response = await fetch(`/api/transfers/${transferId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }
        
        alert('Перемещение успешно обновлено!');
        window.location.href = 'transfers.html';
        
    } catch (error) {
        console.error('Ошибка обновления:', error);
        alert('Ошибка обновления: ' + error.message);
    }
}

// =================== УДАЛЕНИЕ ПЕРЕМЕЩЕНИЯ ===================
async function deleteTransfer() {
    if (!confirm('Вы уверены, что хотите удалить это перемещение? Это действие нельзя отменить.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/transfers/${transferId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Ошибка удаления перемещения');
        }
        
        alert('Перемещение успешно удалено!');
        window.location.href = 'transfers.html';
        
    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('Ошибка удаления: ' + error.message);
    }
}
