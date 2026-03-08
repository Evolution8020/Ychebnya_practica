// Глобальные переменные
let receiptId = null;
let nomenclatureList = [];
let counterpartyList = [];
let warehouseList = [];

// Загрузка при открытии страницы
document.addEventListener("DOMContentLoaded", function () {
    // Получаем ID из URL
    const urlParams = new URLSearchParams(window.location.search);
    receiptId = urlParams.get('id');

    if (!receiptId) {
        alert('ID поступления не указан!');
        window.location.href = 'receipts.html';
        return;
    }

    // Загружаем справочники и данные
    loadReferenceData();
});

// Загрузка справочников
async function loadReferenceData() {
    try {
        // Загружаем номенклатуру
        const nomResponse = await fetch('/api/nomenclatures');
        if (nomResponse.ok) {
            nomenclatureList = await nomResponse.json();
            console.log('Загружено номенклатур:', nomenclatureList.length);
        }

        // Загружаем контрагентов
        const counterpartyResponse = await fetch('/api/counterparties');
        if (counterpartyResponse.ok) {
            counterpartyList = await counterpartyResponse.json();
            populateSelect('counterpartySelect', counterpartyList, 'name');
        }

        // Загружаем склады
        const warehouseResponse = await fetch('/api/warehouses');
        if (warehouseResponse.ok) {
            warehouseList = await warehouseResponse.json();
            populateSelect('warehouseSelect', warehouseList, 'name');
        }

        // Загружаем данные поступления
        await loadReceiptData(receiptId);

        // Настраиваем обработчики кнопок
        setupEventListeners();

    } catch (error) {
        console.error('Ошибка загрузки справочников:', error);
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Кнопка добавления позиции
    document.getElementById('addPositionBtn').addEventListener('click', addNewRow);

    // Кнопка сохранения
    document.getElementById('updateReceiptBtn').addEventListener('click', updateReceipt);

    // Кнопка отмены
    document.getElementById('cancelBtn').addEventListener('click', () => {
        window.location.href = 'receipts.html';
    });
}

// Загрузка данных поступления
async function loadReceiptData(id) {
    try {
        console.log('Загрузка данных для ID:', id);

        const response = await fetch(`/api/receipts/${id}`);

        if (!response.ok) {
            throw new Error(`Ошибка сервера: ${response.status}`);
        }

        const receipt = await response.json();
        console.log('=== ПОСТУПЛЕНИЕ ===');
        console.log('Получены данные:', receipt);
        console.log('receipt.date:', receipt.date);
        console.log('Тип receipt.date:', typeof receipt.date);
        console.log('JSON строкой:', JSON.stringify(receipt.date));
        
        // Обновляем заголовок
        document.getElementById('receiptTitle').textContent = receipt.doc_number;

        // Заполняем основные поля
        // Правильно парсим дату, извлекая время напрямую из строки без конвертации часовых поясов
        let dateStr = receipt.date;
        
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
                document.getElementById('receiptDate').value = datePart;
                
                // Время больше не используется
            } else {
                // Если дата без времени в строке, пытаемся создать Date объект для извлечения времени
                const dateObj = new Date(dateStr);
                if (!isNaN(dateObj.getTime())) {
                    const year = dateObj.getUTCFullYear();
                    const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
                    const day = String(dateObj.getUTCDate()).padStart(2, '0');
                    document.getElementById('receiptDate').value = `${year}-${month}-${day}`;
                    
                    // Время больше не используется
                } else {
                    document.getElementById('receiptDate').value = dateStr;
                }
            }
        } else if (dateStr) {
            // Если дата - не строка (объект Date после JSON.parse)
            const dateObj = new Date(dateStr);
            const year = dateObj.getUTCFullYear();
            const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getUTCDate()).padStart(2, '0');
            document.getElementById('receiptDate').value = `${year}-${month}-${day}`;
            
            // Время больше не используется
        } else {
            document.getElementById('receiptDate').value = '';
        }
        document.getElementById('receiptNumber').value = receipt.doc_number;
        document.getElementById('counterpartySelect').value = receipt.counterparty_id;
        document.getElementById('warehouseSelect').value = receipt.warehouse_id;
        document.getElementById('responsible').value = receipt.responsible;
        document.getElementById('receiptComment').value = receipt.comment || '';

        // Заполняем таблицу позиций
        if (receipt.items && receipt.items.length > 0) {
            populateItemsTable(receipt.items);
        }

        console.log('Все данные загружены!');

    } catch (error) {
        console.error('Ошибка:', error);
        alert('Не удалось загрузить данные: ' + error.message);
    }
}

// Заполнение таблицы позиций
function populateItemsTable(items) {
    const tableBody = document.getElementById('TableBody');
    tableBody.innerHTML = '';

    items.forEach((item, index) => {
        const row = createEditableRow(item, index);
        tableBody.appendChild(row);
    });

    console.log('Добавлено позиций:', items.length);
}

// Создание редактируемой строки
function createEditableRow(item, index) {
    const row = document.createElement('tr');

    // Номенклатура (select)
    const nomCell = document.createElement('td');
    const select = document.createElement('select');
    select.className = 'nomenclature-select';
    select.required = true;

    // Добавляем опции в select
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

    // Количество (input)
    const qtyCell = document.createElement('td');
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.className = 'quantity-input';
    qtyInput.value = item.quantity;
    qtyInput.step = '0.001';
    qtyInput.min = '0';
    qtyInput.required = true;
    qtyCell.appendChild(qtyInput);
    row.appendChild(qtyCell);

    // Цена (input)
    const priceCell = document.createElement('td');
    const priceInput = document.createElement('input');
    priceInput.type = 'number';
    priceInput.className = 'price-input';
    priceInput.value = item.price;
    priceInput.step = '0.01';
    priceInput.min = '0';
    priceInput.required = true;
    priceCell.appendChild(priceInput);
    row.appendChild(priceCell);

    // Сумма (вычисляемое поле)
    const sumCell = document.createElement('td');
    const sumInput = document.createElement('input');
    sumInput.type = 'text';
    sumInput.className = 'sum-input';
    sumInput.readOnly = true;
    sumInput.value = (item.quantity * item.price).toFixed(2);
    sumCell.appendChild(sumInput);
    row.appendChild(sumCell);

    // Действия
    const actionCell = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn delete';
    deleteBtn.textContent = 'Удалить';
    deleteBtn.onclick = () => {
        if (confirm('Удалить эту позицию?')) {
            row.remove();
            recalculateTotals();
        }
    };
    actionCell.appendChild(deleteBtn);
    row.appendChild(actionCell);

    // Обработчики для пересчета сумм
    qtyInput.addEventListener('input', recalculateRowSum);
    priceInput.addEventListener('input', recalculateRowSum);

    return row;
}

// Пересчет суммы для строки
function recalculateRowSum() {
    const row = this.closest('tr');
    const qty = parseFloat(row.querySelector('.quantity-input').value) || 0;
    const price = parseFloat(row.querySelector('.price-input').value) || 0;
    const sumInput = row.querySelector('.sum-input');

    sumInput.value = (qty * price).toFixed(2);
    recalculateTotals();
}

// Пересчет общих итогов
function recalculateTotals() {
    const rows = document.querySelectorAll('#TableBody tr');
    let total = 0;

    rows.forEach(row => {
        const sum = parseFloat(row.querySelector('.sum-input').value) || 0;
        total += sum;
    });

    console.log('Общая сумма:', total.toFixed(2));
}

// Добавление новой пустой строки
function addNewRow() {
    const tableBody = document.getElementById('TableBody');
    const newItem = {
        nomenclature_id: '',
        quantity: 0,
        price: 0
    };
    const row = createEditableRow(newItem, tableBody.children.length);
    tableBody.appendChild(row);
}

// Функция для заполнения select
function populateSelect(selectId, dataList, textField) {
    const select = document.getElementById(selectId);
    if (select) {
        select.innerHTML = '<option value="">Выберите...</option>';

        dataList.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item[textField];
            select.appendChild(option);
        });
    }
}

// Обновление поступления
async function updateReceipt() {
    try {
        // Собираем данные формы
        const receiptDate = document.getElementById('receiptDate').value;
        
        console.log('Отправляемая дата:', receiptDate);
        
        const formData = {
            doc_number: document.getElementById('receiptNumber').value,
            date: receiptDate,
            counterparty_id: parseInt(document.getElementById('counterpartySelect').value),
            warehouse_id: parseInt(document.getElementById('warehouseSelect').value),
            responsible: document.getElementById('responsible').value,
            comment: document.getElementById('receiptComment').value,
            items: []
        };

        // Проверка обязательных полей
        if (!formData.doc_number || !formData.date || isNaN(formData.counterparty_id) ||
            isNaN(formData.warehouse_id) || !formData.responsible) {
            alert('Заполните все обязательные поля!');
            return;
        }

        // Собираем позиции
        const rows = document.querySelectorAll('#TableBody tr');
        if (rows.length === 0) {
            alert('Добавьте хотя бы одну позицию!');
            return;
        }

        for (const row of rows) {
            const select = row.querySelector('.nomenclature-select');
            const quantityInput = row.querySelector('.quantity-input');
            const priceInput = row.querySelector('.price-input');

            const itemData = {
                nomenclature_id: parseInt(select.value),
                quantity: parseFloat(quantityInput.value),
                price: parseFloat(priceInput.value)
            };

            if (isNaN(itemData.nomenclature_id) || isNaN(itemData.quantity) || isNaN(itemData.price)) {
                alert('Проверьте данные во всех позициях!');
                return;
            }

            formData.items.push(itemData);
        }

        // Отправка на сервер
        const response = await fetch(`/api/receipts/${receiptId}`, {
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

        alert('Поступление успешно обновлено!');
        window.location.href = 'receipts.html';

    } catch (error) {
        console.error('Ошибка обновления:', error);
        alert('Ошибка обновления: ' + error.message);
    }
}