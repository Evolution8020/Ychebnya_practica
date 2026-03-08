// =====================================================
// СОЗДАНИЕ ПЕРЕМЕЩЕНИЯ
// =====================================================

let nomenclatures = [];
let warehouses = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadNomenclatures();
    await loadWarehouses();
    
    // Автогенерация номера документа
    const docNumber = await generateDocNumber();
    document.getElementById('docNumber').value = docNumber;
    
    // Текущая дата
    document.getElementById('transferDate').value = new Date().toISOString().split('T')[0];
    
    // Автозаполнение ответственного
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.full_name) {
        document.getElementById('responsible').value = user.full_name;
    }
    
    // Обработчики
    document.getElementById('addPositionBtn').addEventListener('click', addItemRow);
    document.getElementById('saveBtn').addEventListener('click', saveTransfer);
    document.getElementById('cancelBtn').addEventListener('click', () => {
        window.location.href = 'transfers.html';
    });
});

// =================== ГЕНЕРАЦИЯ НОМЕРА ===================
async function generateDocNumber() {
    try {
        const response = await fetch('/api/transfers');
        if (!response.ok) throw new Error('Ошибка');
        
        const transfers = await response.json();
        let maxNumber = 0;
        
        transfers.forEach(t => {
            if (t.doc_number) {
                const numMatch = t.doc_number.match(/(\d+)/);
                if (numMatch) {
                    const num = parseInt(numMatch[1]);
                    if (num > maxNumber) maxNumber = num;
                }
            }
        });
        
        return String(maxNumber + 1);
    } catch (error) {
        return String(Date.now()).slice(-6);
    }
}

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

// =================== СОХРАНЕНИЕ ===================
async function saveTransfer() {
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
        const response = await fetch('/api/transfers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }
        
        alert('Перемещение успешно создано!');
        window.location.href = 'transfers.html';
        
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        alert('Ошибка сохранения: ' + error.message);
    }
}



