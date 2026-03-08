const tableBody = document.querySelector("#warehouseTable tbody");
const addBtn = document.getElementById("addBtn");
const editBtn = document.getElementById("editBtn");
const deleteBtn = document.getElementById("deleteBtn");
const modal = document.getElementById("warehouseModal");
const closeModal = document.querySelector(".close-modal");
const saveBtn = document.getElementById("saveBtn");
const searchInput = document.getElementById("searchInput");

let editingRow = null; // null = добавление новой записи


// Функция генерации номера
function generateItemNumber() {
    const rows = tableBody.querySelectorAll("tr");
    let maxNumber = 0;

    rows.forEach(row => {
        const numText = row.children[0].innerText; 
        const num = parseInt(numText, 10);        
        if (!isNaN(num) && num > maxNumber) maxNumber = num;
    });

    return String(maxNumber + 1).padStart(6, "0"); // формат 000001, 000002...
}


// Функция загрузки данных с БД
async function loadWarehouse() {
    try {
        const response = await fetch('/api/warehouses');
        if (!response.ok) throw new Error("Ошибка загрузки базы данных");

        const warehouses = await response.json();
        tableBody.innerHTML = "";

        warehouses.forEach(item => {
            const row = document.createElement("tr");
            row.dataset.id = item.id; // сохраняем id для редактирования/удаления
            row.innerHTML = `
                <td>${item.number}</td>
                <td>${item.name}</td>
                <td>${item.type}</td>
                <td>${item.address || ""}</td>
                <td>${item.comment || ""}</td>
            `;
            tableBody.appendChild(row);
        });
    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

loadWarehouse();


// Выделение строки
tableBody.addEventListener("click", e => {
    const row = e.target.closest("tr");
    if (!row) return;
    tableBody.querySelectorAll("tr").forEach(r => r.classList.remove("selected"));
    row.classList.add("selected");
});


// Поиск
searchInput.addEventListener("input", () => {
    const filter = searchInput.value.toLowerCase();
    tableBody.querySelectorAll("tr").forEach(row => {
        const match = Array.from(row.children).some(td => td.innerText.toLowerCase().includes(filter));
        row.style.display = match ? "" : "none";
    });
});


// Сортировка по клику
const headers = document.querySelectorAll("#warehouseTable th");
headers.forEach((th, index) => {
    const arrow = document.createElement("span");
    arrow.classList.add("sort-arrow");
    arrow.innerHTML = "&#9650;"; // ▲
    th.appendChild(arrow);

    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
        const rowsArray = Array.from(tableBody.querySelectorAll("tr"));
        const ascending = !th.asc;
        th.asc = ascending;
        headers.forEach(h => h.classList.remove("asc"));
        if (!ascending) th.classList.add("asc");

        rowsArray.sort((a, b) => {
            const aText = a.children[index].innerText.toLowerCase();
            const bText = b.children[index].innerText.toLowerCase();
            if (!isNaN(aText) && !isNaN(bText)) return ascending ? aText - bText : bText - aText;
            return ascending ? aText.localeCompare(bText) : bText.localeCompare(aText);
        });

        rowsArray.forEach(row => tableBody.appendChild(row));
    });
});


// Логика удаление записи из таблицы
deleteBtn.addEventListener("click", async () => {
    // Ищем выделенную строку
    const row = tableBody.querySelector("tr.selected");
    if (!row) {
        alert("Выберите строку для удаления");
        return;
    }

    if (!confirm("Удалить запись?")) return;

    const id = row.dataset.id; // предполагается, что у каждой строки есть data-id

    try {
        const res = await fetch(`/api/warehouses/${id}`, { method: "DELETE" });

        if (!res.ok) {
            throw new Error(`Ошибка сервера: ${res.status}`);
        }

        // Удаляем строку прямо из таблицы
        row.remove();

    } catch (e) {
        console.error(e);
        alert("Ошибка удаления");
    }
});


// Открытие модального окна
function openModal() {
    modal.style.display = 'flex';
    document.getElementById('itemName').value = '';
    document.getElementById('address').value = 'л';
    document.getElementById('comment').value = '';

    document.getElementById('itemNumber').value = generateItemNumber();
}

//Закрытие модального окна
function closeModalFunc() {
    modal.style.display = 'none';
}


addBtn.addEventListener('click', openModal);
closeModal.addEventListener('click', closeModalFunc);


//Вставка строки в таблицу
function addRowToTable(data) {
    const row = document.createElement('tr');
    row.dataset.id = data.id; // сохраняем id для дальнейшего редактирования/удаления
    row.innerHTML = `
        <td>${data.number}</td>
        <td>${data.name}</td>
        <td>${data.type}</td>
        <td>${data.address}</td>
        <td>${data.comment || ''}</td>
    `;
    tableBody.appendChild(row);

    row.addEventListener('click', () => {
        document.querySelectorAll('#warehouseTable tbody tr').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
    });
}


// Сохранение через API

saveBtn.addEventListener('click', async () => {
    const name = document.getElementById('itemName').value.trim();
    const type = document.getElementById('type').value.trim();
    const address = document.getElementById('address').value.trim();
    const comment = document.getElementById('comment').value.trim();
    const number = document.getElementById('itemNumber').value.trim();

    if (!name) {
        alert('Введите наименование склада!');
        return;
    }

    const payload = {
        name: name,
        type: type,
        address: address,
        comment: comment,
        number: number
    };

    try {

        // ===== РЕДАКТИРОВАНИЕ =====
        if (editingRow) {

            const id = editingRow.dataset.id;

            const res = await fetch(`/api/warehouses/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Ошибка редактирования');

            const updated = await res.json();

            // Обновление строки
            editingRow.children[0].innerText = updated.number;
            editingRow.children[1].innerText = updated.name;
            editingRow.children[2].innerText = updated.type;
            editingRow.children[3].innerText = updated.address;
            editingRow.children[4].innerText = updated.comment || '';

            editingRow = null;
            modalTitle.textContent = 'Добавить склад';
        }

        // ===== ДОБАВЛЕНИЕ =====
        else {
            const response = await fetch('/api/warehouses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Ошибка при сохранении');

            const item = await response.json();
            addRowToTable(item); // ← важно, добавляем только здесь
        }

        closeModalFunc();

    } catch (err) {
        console.error(err);
        alert('Не удалось сохранить запись.');
    }
});


// Редактирование записи
editBtn.addEventListener('click', () => {
    const row = tableBody.querySelector('tr.selected');
    if (!row) {
        alert('Выберите строку для редактирования');
        return;
    }

    editingRow = row;
    modalTitle.textContent = 'Редактировать склад';

    // Заполняем модальное окно правильными полями
    document.getElementById('itemNumber').value = row.children[0].innerText;  // number
    document.getElementById('itemName').value = row.children[1].innerText;    // name
    document.getElementById('type').value = row.children[2].innerText;
    document.getElementById('address').value = row.children[3].innerText;      // address
    document.getElementById('comment').value = row.children[4].innerText;      // comment

    modal.style.display = 'flex';
});

