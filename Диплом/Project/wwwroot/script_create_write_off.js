let writeOffId = null;
let nomenclatureList = [];
let warehouseList = [];

// Загрузка при открытии страницы
document.addEventListener("DOMContentLoaded", function () {
    const urlParams = new URLSearchParams(window.location.search);
    writeOffId = urlParams.get('id');

    if (writeOffId) {
        document.getElementById('receiptTitle').textContent = `Редактирование списания`;
        loadWriteOffData(writeOffId);
    } else {
        // Автозаполнение поля "Ответственный" из данных текущего пользователя (только при создании)
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.full_name) {
            const responsibleField = document.getElementById("responsiblePerson");
            if (responsibleField) {
                responsibleField.value = user.full_name;
            }
        }
    }

    loadReferenceData();
    setupEventListeners();
});

// Загрузка справочников
async function loadReferenceData() {
    try {
        const nomResponse = await fetch('/api/nomenclatures');
        if (nomResponse.ok) {
            nomenclatureList = await nomResponse.json();
        }

        const warehouseResponse = await fetch('/api/warehouses');
        if (warehouseResponse.ok) {
            warehouseList = await warehouseResponse.json();
            populateSelect('warehouseSelect', warehouseList, 'name');
        }
    } catch (error) {
        console.error('Ошибка загрузки справочников:', error);
    }
}

// Загрузка данных списания
async function loadWriteOffData(id) {
    try {
        const response = await fetch(`/api/writeoffs/${id}`);
        if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);

        const writeoff = await response.json();

        // Заполняем поля
        document.getElementById('writeOffDate').value = writeoff.date.split('T')[0];
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
    } catch (error) {
        console.error('Ошибка загрузки списания:', error);
        alert('Не удалось загрузить данные списания');
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
    document.getElementById('saveWriteOffBtn').addEventListener('click', saveWriteOff);
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

// Сохранение списания
async function saveWriteOff() {
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

        // Отправка на сервер
        const url = writeOffId ? `/api/writeoffs/${writeOffId}` : '/api/writeoffs';
        const method = writeOffId ? 'PUT' : 'POST';

        let response;
        try {
            response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        } catch (networkError) {
            alert('Ошибка сети. Проверьте подключение к серверу и попробуйте снова.');
            return; // Остаемся на странице при сетевой ошибке
        }

        if (!response.ok) {
            let errorMessage = `Ошибка сервера: ${response.status}`;
            try {
                const errorText = await response.text();
                if (errorText) {
                    // Пытаемся распарсить JSON ошибку
                    try {
                        const errorJson = JSON.parse(errorText);
                        errorMessage = errorJson.title || errorJson.detail || errorJson.message || errorMessage;
                    } catch {
                        // Если не JSON, используем текст как есть (но ограничиваем длину)
                        if (errorText.length < 200) {
                            errorMessage = errorText;
                        } else {
                            errorMessage = `Ошибка ${response.status}. ${errorText.substring(0, 100)}...`;
                        }
                    }
                }
            } catch (e) {
                errorMessage = `Ошибка ${response.status}. Проверьте данные и попробуйте снова.`;
            }
            alert(errorMessage);
            return; // Остаемся на странице при ошибке
        }

        alert(writeOffId ? 'Списание успешно обновлено!' : 'Списание успешно создано!');
        window.location.href = 'write_off.html';

    } catch (error) {
        console.error('Ошибка сохранения:', error);
        alert('Ошибка сохранения: ' + (error.message || 'Неизвестная ошибка'));
        // Остаемся на странице при ошибке
    }
}