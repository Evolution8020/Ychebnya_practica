// ------------------------- Генерация номера УПД -------------------------
// Формат по российскому стандарту: порядковый номер документа
async function generateUPDNumber() {
    try {
        const response = await fetch("/api/receipts");
        if (!response.ok) throw new Error("Ошибка загрузки");
        
        const receipts = await response.json();
        
        // Находим максимальный номер среди существующих
        let maxNumber = 0;
        
        receipts.forEach(r => {
            if (r.doc_number) {
                // Пытаемся извлечь число из номера документа
                const numMatch = r.doc_number.match(/(\d+)/);
                if (numMatch) {
                    const num = parseInt(numMatch[1]);
                    if (num > maxNumber) {
                        maxNumber = num;
                    }
                }
            }
        });
        
        // Следующий номер
        const nextNumber = maxNumber + 1;
        
        // Формат: порядковый номер (можно изменить на "УПД-XXX" если нужно)
        return String(nextNumber);
        
    } catch (error) {
        console.error("Ошибка генерации номера УПД:", error);
        // Если не удалось получить данные, генерируем номер на основе даты/времени
        return String(Date.now()).slice(-6);
    }
}

// ------------------------- Загрузка складов -------------------------
async function loadWarehouses() {
    const select = document.querySelector("#warehouseSelect");
    select.innerHTML = `<option value="">-- Выберите склад --</option>`;

    try {
        const response = await fetch("/api/warehouses");
        if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
        const data = await response.json();

        data.forEach(w => {
            const option = document.createElement("option");
            option.value = w.id;
            option.textContent = w.name;
            select.appendChild(option);
        });
    } catch (err) {
        console.error("Ошибка при загрузке складов:", err);
        alert("Не удалось загрузить склады");
    }
}

// ------------------------- Загрузка контрагентов -------------------------
async function loadCounterparties() {
    const select = document.querySelector("#counterpartySelect");
    select.innerHTML = `<option value="">-- Выберите контрагента --</option>`;

    try {
        const response = await fetch("/api/counterparties");
        if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
        const data = await response.json();

        data.forEach(c => {
            const option = document.createElement("option");
            option.value = c.id;
            option.textContent = c.name;
            select.appendChild(option);
        });
    } catch (err) {
        console.error("Ошибка при загрузке контрагентов:", err);
        alert("Не удалось загрузить контрагентов");
    }
}

// ------------------------- Вызов при загрузке страницы -------------------------
document.addEventListener("DOMContentLoaded", async () => {
    await loadWarehouses();
    await loadCounterparties();

    // Автогенерация номера УПД
    const updNumber = await generateUPDNumber();
    const receiptNumberField = document.getElementById("receiptNumber");
    if (receiptNumberField) {
        receiptNumberField.value = updNumber;
    }

    // Установка текущей даты
    const today = new Date().toISOString().split('T')[0];
    const dateField = document.getElementById("receiptDate");
    if (dateField && !dateField.value) {
        dateField.value = today;
    }

    // Автозаполнение поля "Ответственный" из данных текущего пользователя
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.full_name) {
        const responsibleField = document.getElementById("responsible");
        if (responsibleField) {
            responsibleField.value = user.full_name;
        }
    }
});


// Массив для хранения позиций
let receiptItems = [];

// Элемент tbody таблицы
const tableBody = document.getElementById("TableBody");

// ------------------ Функция добавления новой позиции ------------------
async function addReceiptItem() {
    // Создаем объект позиции
    const newItem = {
        id: null,                // id в БД, пока null
        nomenclature_id: null,    // выбранная номенклатура
        nomenclature_name: "",    // название
        quantity: 0,
        price: 0,
        sum: 0
    };

    // Добавляем в массив
    receiptItems.push(newItem);

    // Создаем строку
    const row = document.createElement("tr");

    // Получаем номенклатуру из API
    let nomenclatureOptions = [];
    try {
        const response = await fetch("/api/nomenclatures");
        if (!response.ok) throw new Error("Ошибка загрузки номенклатуры");
        nomenclatureOptions = await response.json();
    } catch (err) {
        console.error(err);
        alert("Не удалось загрузить номенклатуру");
    }

    // Строим HTML строки
    row.innerHTML = `
        <td>
            <select class="nomenclatureSelect">
                <option value="">-- Выберите номенклатуру --</option>
                ${nomenclatureOptions.map(n => `<option value="${n.id}">${n.name}</option>`).join("")}
            </select>
        </td>
        <td><input type="number" class="quantityInput" value="0" min="0"></td>
        <td><input type="number" class="priceInput" value="0" min="0" step="0.01"></td>
        <td class="sumCell">0</td>
        <td><button class="deleteBtn">Удалить</button></td>
    `;

    tableBody.appendChild(row);

    // Событие выбора номенклатуры
    const select = row.querySelector(".nomenclatureSelect");
    select.addEventListener("change", () => {
        const selected = nomenclatureOptions.find(n => n.id == select.value);
        newItem.nomenclature_id = selected ? selected.id : null;
        newItem.nomenclature_name = selected ? selected.name : "";
    });

    // Событие изменения количества
    const qtyInput = row.querySelector(".quantityInput");
    qtyInput.addEventListener("input", () => {
        newItem.quantity = parseFloat(qtyInput.value) || 0;
        updateRowSum();
    });

    // Событие изменения цены
    const priceInput = row.querySelector(".priceInput");
    priceInput.addEventListener("input", () => {
        newItem.price = parseFloat(priceInput.value) || 0;
        updateRowSum();
    });

    // Событие удаления
    row.querySelector(".deleteBtn").addEventListener("click", () => {
        const index = receiptItems.indexOf(newItem);
        if (index > -1) receiptItems.splice(index, 1);
        row.remove();
    });

    // Функция пересчета суммы в строке
    function updateRowSum() {
        newItem.sum = newItem.quantity * newItem.price;
        row.querySelector(".sumCell").textContent = newItem.sum.toFixed(2);
    }
}

// Привязка кнопки добавления
document.getElementById("addPositionBtn").addEventListener("click", addReceiptItem);



async function saveReceipt() {
    try {
        // --- 1. Получаем элементы формы ---
        const receiptDate = document.getElementById("receiptDate").value;
        const receiptNumber = document.getElementById("receiptNumber").value;
        const counterpartyId = parseInt(document.getElementById("counterpartySelect").value);
        const warehouseId = parseInt(document.getElementById("warehouseSelect").value);
        const responsible = document.getElementById("responsible").value;
        const comment = document.getElementById("receiptComment").value;

        console.log('Отправляемая дата:', receiptDate);

        // Получаем tableBody внутри функции
        const tableBody = document.getElementById("TableBody");
        console.log("tableBody:", tableBody);

        // --- 2. Проверка обязательных полей ---
        if (!receiptDate || !receiptNumber || isNaN(counterpartyId) || isNaN(warehouseId) || !responsible) {
            alert("Заполните все обязательные поля!");
            return;
        }

        // --- 3. Сбор позиций ---
        const rows = tableBody.querySelectorAll("tr");
        if (rows.length === 0) {
            alert("Добавьте хотя бы одну позицию!");
            return;
        }

        const items = [];
        for (let index = 0; index < rows.length; index++) {
            const row = rows[index];
            const nomenclatureSelect = row.querySelector("select");
            const quantityInput = row.querySelector(".quantityInput");
            const priceInput = row.querySelector(".priceInput");

            // Проверяем, что элементы существуют
            if (!nomenclatureSelect || !quantityInput || !priceInput) {
                alert(`Не все поля заполнены в позиции №${index + 1}.`);
                return;
            }

            const itemData = {
                nomenclature_id: parseInt(nomenclatureSelect.value),
                quantity: parseFloat(quantityInput.value),
                price: parseFloat(priceInput.value)
            };

            // Проверка корректности данных позиции
            if (isNaN(itemData.nomenclature_id) || isNaN(itemData.quantity) || isNaN(itemData.price)) {
                alert(`Проверьте данные позиции №${index + 1}.`);
                return;
            }

            items.push(itemData);
        }

        console.log("Позиции:", items);

        // --- 4. Формируем полный объект поступления с позициями ---
        const receiptData = {
            doc_number: receiptNumber,
            doc_ref: "",
            date: receiptDate,
            counterparty_id: counterpartyId,
            warehouse_id: warehouseId,
            responsible: responsible,
            comment: comment,
            items: items
        };

        console.log("Отправка receiptData:", receiptData);

        // --- 5. Отправка на сервер ---
        const response = await fetch("/api/receipts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(receiptData)
        });

        const responseText = await response.text();
        if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}, ${responseText}`);

        alert("Поступление успешно сохранено!");

        // --- 6. Очистка формы и таблицы ---
        document.getElementById("receiptDate").value = "";
        document.getElementById("receiptNumber").value = "";
        document.getElementById("counterpartySelect").value = "";
        document.getElementById("warehouseSelect").value = "";
        document.getElementById("responsible").value = "";
        document.getElementById("receiptComment").value = "";
        tableBody.innerHTML = "";

    } catch (err) {
        console.error("Ошибка при сохранении:", err);
        alert("Ошибка при сохранении: " + err.message);
    }
}

// --- Привязка кнопки ---
document.addEventListener("DOMContentLoaded", () => {
    const saveButton = document.getElementById("saveReceiptBtn");
    if (saveButton) {
        saveButton.addEventListener("click", saveReceipt);
    } else {
        console.error("Кнопка saveReceiptBtn не найдена!");
    }
});


// Обработчик кнопки "Отмена"
document.getElementById('cancelBtn').addEventListener('click', () => {
    window.location.href = 'receipts.html';
});