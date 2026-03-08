let writeOffId = null;
let nomenclatureList = [];
let warehouseList = [];

// Загрузка при открытии страницы
document.addEventListener("DOMContentLoaded", function () {
    const urlParams = new URLSearchParams(window.location.search);
    writeOffId = urlParams.get('id');

    if (!writeOffId) {
        alert('ID списания не указан!');
        window.location.href = 'write_off.html';
        return;
    }

    loadReferenceData();
    setupEventListeners();
});

// Загрузка справочников
async function loadReferenceData() {
    try {
        // Загружаем номенклатуру
        const nomResponse = await fetch('/api/nomenclatures');
        if (nomResponse.ok) {
            nomenclatureList = await nomResponse.json();
        }

        // Загружаем склады
        const warehouseResponse = await fetch('/api/warehouses');
        if (warehouseResponse.ok) {
            warehouseList = await warehouseResponse.json();
            populateSelect('warehouseSelect', warehouseList, 'name');
        }

        // Загружаем данные списания
        await loadWriteOffData(writeOffId);

    } catch (error) {
        console.error('Ошибка загрузки справочников:', error);
        alert('Ошибка загрузки справочников');
    }
}

// Загрузка данных списания
async function loadWriteOffData(id) {
    try {
        const response = await fetch(`/api/writeoffs/${id}`);
        if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);

        const writeoff = await response.json();
        console.log('=== СПИСАНИЕ ===');
        console.log('Получены данные:', writeoff);
        console.log('writeoff.date:', writeoff.date);
        console.log('Тип writeoff.date:', typeof writeoff.date);
        console.log('JSON строкой:', JSON.stringify(writeoff.date));

        // Обновляем заголовок
        document.getElementById('writeOffTitle').textContent = writeoff.doc_number;

        // Заполняем поля формы
        // Правильно парсим дату, извлекая время напрямую из строки без конвертации часовых поясов
        let dateStr = writeoff.date;
        
        // Преобразуем дату в строку, если необходимо
        if (dateStr && typeof dateStr !== 'string') {
            dateStr = String(dateStr);
        }
        
        console.log('dateStr после преобразования:', dateStr);
        
        // Извлекаем дату и время из ISO строки напрямую
        if (typeof dateStr === 'string' && dateStr) {
            if (dateStr.includes('T')) {
                // Разделяем дату и время
                const [datePart, timePart] = dateStr.split('T');
                document.getElementById('writeOffDate').value = datePart;
                
                // Время больше не используется
            } else {
                // Если дата без времени в строке, пытаемся создать Date объект для извлечения времени
                const dateObj = new Date(dateStr);
                if (!isNaN(dateObj.getTime())) {
                    const year = dateObj.getUTCFullYear();
                    const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
                    const day = String(dateObj.getUTCDate()).padStart(2, '0');
                    document.getElementById('writeOffDate').value = `${year}-${month}-${day}`;
                    
                    // Время больше не используется
                } else {
                    document.getElementById('writeOffDate').value = dateStr;
                }
            }
        } else if (dateStr) {
            // Если дата - не строка (объект Date после JSON.parse)
            const dateObj = new Date(dateStr);
            const year = dateObj.getUTCFullYear();
            const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getUTCDate()).padStart(2, '0');
            document.getElementById('writeOffDate').value = `${year}-${month}-${day}`;
            
            // Время больше не используется
        } else {
            document.getElementById('writeOffDate').value = '';
        }
        document.getElementById('writeOffNumber').value = writeoff.doc_number;
        document.getElementById('warehouseSelect').value = writeoff.warehouse_id;
        document.getElementById('responsiblePerson').value = writeoff.responsible;
        document.getElementById('writeOffReason').value = writeoff.reason;
        document.getElementById('writeOffComment').value = writeoff.comment || '';
        document.getElementById('writeOffBasis').value = writeoff.basis || '';

        // Заполняем таблицу позиций
        if (writeoff.items && writeoff.items.length > 0) {
            populateItemsTable(writeoff.items);
        }

        console.log('Данные списания загружены!');

    } catch (error) {
        console.error('Ошибка загрузки списания:', error);
        alert('Не удалось загрузить данные списания: ' + error.message);
        window.location.href = 'write_off.html';
    }
}

// Заполнение таблицы позиций
function populateItemsTable(items) {
    const tableBody = document.getElementById('positionsTableBody');
    tableBody.innerHTML = '';

    items.forEach((item, index) => {
        const row = createItemRow(item, index);
        tableBody.appendChild(row);
    });
}

// Создание строки позиции
function createItemRow(item, index) {
    const row = document.createElement('tr');

    // Номенклатура
    const nomCell = document.createElement('td');
    const select = document.createElement('select');
    select.className = 'nomenclature-select';
    select.required = true;

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Выберите номенклатуру';
    select.appendChild(defaultOption);

    nomenclatureList.forEach(nom => {
        const option = document.createElement('option');
        option.value = nom.id;
        option.textContent = nom.name;
        if (nom.id === item.nomenclature_id) {
            option.selected = true;
        }
        select.appendChild(option);
    });
    nomCell.appendChild(select);
    row.appendChild(nomCell);

    // Количество
    const qtyCell = document.createElement('td');
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.className = 'quantity-input';
    qtyInput.value = item.quantity;
    qtyInput.step = '0.001';
    qtyInput.min = '0.001';
    qtyInput.required = true;
    qtyCell.appendChild(qtyInput);
    row.appendChild(qtyCell);

    // Единица измерения
    const unitCell = document.createElement('td');
    unitCell.textContent = item.unit || '-';
    row.appendChild(unitCell);

    // Действия
    const actionCell = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn delete';
    deleteBtn.textContent = 'Удалить';
    deleteBtn.onclick = () => {
        if (confirm('Удалить эту позицию?')) {
            row.remove();
        }
    };
    actionCell.appendChild(deleteBtn);
    row.appendChild(actionCell);

    return row;
}

// Настройка обработчиков
function setupEventListeners() {
    document.getElementById('addPositionBtn').addEventListener('click', addNewRow);
    document.getElementById('updateWriteOffBtn').addEventListener('click', updateWriteOff);
    document.getElementById('deleteWriteOffBtn').addEventListener('click', deleteWriteOff);
    document.getElementById('cancelBtn').addEventListener('click', () => {
        window.location.href = 'write_off.html';
    });
}

// Добавление новой строки
function addNewRow() {
    const tableBody = document.getElementById('positionsTableBody');
    const newItem = {
        nomenclature_id: '',
        quantity: '',
        unit: '-'
    };
    const row = createItemRow(newItem, tableBody.children.length);
    tableBody.appendChild(row);
}

// Заполнение select
function populateSelect(selectId, dataList, textField) {
    const select = document.getElementById(selectId);
    if (select) {
        dataList.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item[textField];
            select.appendChild(option);
        });
    }
}

// Обновление списания
async function updateWriteOff() {
    try {
        const writeOffDate = document.getElementById('writeOffDate').value;
        
        console.log('Отправляемая дата:', writeOffDate);
        
        const formData = {
            doc_number: document.getElementById('writeOffNumber').value,
            date: writeOffDate,
            warehouse_id: parseInt(document.getElementById('warehouseSelect').value),
            responsible: document.getElementById('responsiblePerson').value,
            reason: document.getElementById('writeOffReason').value,
            comment: document.getElementById('writeOffComment').value,
            basis: document.getElementById('writeOffBasis').value,
            items: []
        };

        // Проверка обязательных полей
        if (!formData.doc_number || !formData.date || isNaN(formData.warehouse_id) ||
            !formData.responsible || !formData.reason) {
            alert('Заполните все обязательные поля!');
            return;
        }

        // Собираем позиции
        const rows = document.querySelectorAll('#positionsTableBody tr');
        if (rows.length === 0) {
            alert('Добавьте хотя бы одну позицию!');
            return;
        }

        for (const row of rows) {
            const select = row.querySelector('.nomenclature-select');
            const quantityInput = row.querySelector('.quantity-input');

            const itemData = {
                nomenclature_id: parseInt(select.value),
                quantity: parseFloat(quantityInput.value)
            };

            if (isNaN(itemData.nomenclature_id) || isNaN(itemData.quantity)) {
                alert('Проверьте данные во всех позициях!');
                return;
            }

            formData.items.push(itemData);
        }

        // Отправка PUT запроса
        const response = await fetch(`/api/writeoffs/${writeOffId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ошибка сервера: ${response.status}, ${errorText}`);
        }

        alert('Списание успешно обновлено!');
        window.location.href = 'write_off.html';

    } catch (error) {
        console.error('Ошибка обновления:', error);
        alert('Ошибка обновления: ' + error.message);
    }
}

// Удаление списания
async function deleteWriteOff() {
    if (!confirm('Вы уверены, что хотите удалить это списание? Это действие нельзя отменить.')) {
        return;
    }

    try {
        const response = await fetch(`/api/writeoffs/${writeOffId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Ошибка удаления списания');
        }

        alert('Списание успешно удалено!');
        window.location.href = 'write_off.html';

    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('Ошибка удаления: ' + error.message);
    }
}