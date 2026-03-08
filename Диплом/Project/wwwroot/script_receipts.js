const tableBody = document.querySelector("#receiptsTable tbody");
const addBtn = document.getElementById("addBtn");
const editBtn = document.getElementById("editBtn");
const deleteBtn = document.getElementById("deleteBtn");
const saveBtn = document.getElementById("saveBtn");
const modal = document.getElementById("receiptModal");
const closeModal = document.querySelector(".close-modal");
const searchInput = document.getElementById("searchInput");
const modalTitle = document.getElementById("modalTitle");

const dateInput = document.getElementById('receiptDate');
const numberInput = document.getElementById('receiptNumber');
const counterpartySelect = document.getElementById('counterpartySelect');
const warehouseSelect = document.getElementById('warehouseSelect');
const responsibleInput = document.getElementById('responsibleInput');
const commentInput = document.getElementById('receiptComment');
const itemsTableBody = document.querySelector('#receiptItems tbody');

let editingRow = null;
let receiptItems = []; // массив позиций внутри модалки
let selectedReceiptId = null; // Переменная для хранения выбранного ID


// В начале файла добавьте проверку
console.log('editBtn элемент:', editBtn);
if (!editBtn) {
    console.error('Кнопка editBtn не найдена!');
}


// ------------------------- Загрузка поступлений -------------------------
async function loadReceipts() {
    try {
        const response = await fetch("/api/receipts");
        if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
        const receipts = await response.json();
        tableBody.innerHTML = "";

        console.log("Полученные поступления:", receipts);

        receipts.forEach(r => {
            const row = document.createElement("tr");
            row.dataset.id = r.id;
            row.innerHTML = `
                <td>${r.id}</td>
                <td>${new Date(r.date).toLocaleDateString()}</td>
                <td>${r.doc_number}</td>
                <td>${r.counterpartyName}</td>
                <td>${r.totalSum.toFixed(2)}</td>
                <td>${r.warehouseName}</td>
                <td>${r.responsible}</td>
            `;
            tableBody.appendChild(row);

            // Обработчик клика на строку
            row.addEventListener('click', function () {
                // Снимаем выделение со всех строк
                tableBody.querySelectorAll("tr").forEach(tr => tr.classList.remove("selected"));

                // Выделяем текущую строку
                this.classList.add("selected");

                // Сохраняем ID выбранного поступления
                selectedReceiptId = this.dataset.id;
                console.log('Выбрано поступление ID:', selectedReceiptId);

                // Дополнительная проверка
                console.log('selectedReceiptId тип:', typeof selectedReceiptId);
                console.log('selectedReceiptId значение:', selectedReceiptId);
            });
        });
    } catch (err) {
        console.error("Ошибка при загрузке поступлений:", err);
        alert("Не удалось загрузить поступления");
    }
}

loadReceipts();

// ------------------------- Поиск по таблице -------------------------
searchInput.addEventListener("input", () => {
    const filter = searchInput.value.toLowerCase();
    tableBody.querySelectorAll("tr").forEach(row => {
        const match = Array.from(row.children).some(td => td.innerText.toLowerCase().includes(filter));
        row.style.display = match ? "" : "none";
    });
});

// ------------------------- Сортировка -------------------------
document.querySelectorAll("#receiptsTable th").forEach((th, index) => {
    const arrow = document.createElement("span");
    arrow.classList.add("sort-arrow");
    arrow.innerHTML = "&#9650;"; // ▲
    th.appendChild(arrow);

    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
        const rowsArray = Array.from(tableBody.querySelectorAll("tr"));
        const ascending = !th.asc;
        th.asc = ascending;
        document.querySelectorAll("#receiptsTable th").forEach(h => h.classList.remove("asc"));
        if (!ascending) th.classList.add("asc");

        rowsArray.sort((a, b) => {
            const aText = a.children[index].innerText.toLowerCase();
            const bText = b.children[index].innerText.toLowerCase();
            const numA = parseFloat(aText.replace(/[^0-9.-]+/g, ""));
            const numB = parseFloat(bText.replace(/[^0-9.-]+/g, ""));
            if (!isNaN(numA) && !isNaN(numB)) return ascending ? numA - numB : numB - numA;
            return ascending ? aText.localeCompare(bText) : bText.localeCompare(aText);
        });

        rowsArray.forEach(row => tableBody.appendChild(row));
    });
});


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

// Функция редактирования
function editReceipt(receiptId) {
    console.log('Переход к редактированию, ID:', receiptId);

    if (!receiptId || receiptId === "null" || receiptId === "undefined") {
        alert("Ошибка: ID поступления не определен!");
        return;
    }

    window.location.href = `edit_receipts.html?id=${receiptId}`;
}

// Обработчик для кнопки редактирования над таблицей
editBtn.addEventListener('click', (e) => {
    e.preventDefault(); // отменяем любые дефолтные действия

    if (!selectedReceiptId) {
        alert("Выберите поступление!");
        return; // точно останавливаем выполнение
    }

    // Здесь точно ID есть
    const url = `edit_receipts.html?id=${encodeURIComponent(selectedReceiptId)}`;
    console.log('Переход по URL:', url);
    window.location.href = url;
});


// Обработчик для кнопки удаления
deleteBtn.addEventListener("click", async () => {
    console.log('Нажата кнопка удаления, selectedReceiptId:', selectedReceiptId);

    if (!selectedReceiptId) {
        alert("Выберите поступление для удаления!");
        return;
    }

    if (!confirm('Вы уверены, что хотите удалить это поступление? Это действие нельзя отменить.')) {
        return;
    }

    try {
        const response = await fetch(`/api/receipts/${selectedReceiptId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ошибка сервера: ${response.status}, ${errorText}`);
        }

        alert('Поступление успешно удалено!');

        // Перезагружаем таблицу
        await loadReceipts();

        // Сбрасываем выбранный ID
        selectedReceiptId = null;

    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('Ошибка удаления: ' + error.message);
    }
});