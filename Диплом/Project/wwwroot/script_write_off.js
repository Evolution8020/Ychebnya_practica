const tableBody = document.querySelector("#write_offTable tbody");
const addBtn = document.getElementById("addBtn");
const editBtn = document.getElementById("editBtn");
const deleteBtn = document.getElementById("deleteBtn");
const searchInput = document.getElementById("searchInput");

let selectedWriteOffId = null;

// Загрузка списаний
async function loadWriteOffs() {
    try {
        const response = await fetch("/api/writeoffs");
        if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
        const writeoffs = await response.json();

        tableBody.innerHTML = "";
        console.log("Полученные списания:", writeoffs);

        writeoffs.forEach(w => {
            const row = document.createElement("tr");
            row.dataset.id = w.id;
            row.innerHTML = `
                <td>${w.id}</td>
                <td>${new Date(w.date).toLocaleDateString()}</td>
                <td>${w.operation_type}</td>
                <td>${w.warehouseName}</td>
                <td>${w.responsible}</td>
                <td>${w.comment || ''}</td>
            `;
            tableBody.appendChild(row);

            row.addEventListener('click', function () {
                tableBody.querySelectorAll("tr").forEach(tr => tr.classList.remove("selected"));
                this.classList.add("selected");
                selectedWriteOffId = this.dataset.id;
                console.log('Выбрано списание ID:', selectedWriteOffId);
            });
        });
    } catch (err) {
        console.error("Ошибка при загрузке списаний:", err);
        alert("Не удалось загрузить списания");
    }
}

// Поиск
searchInput.addEventListener("input", () => {
    const filter = searchInput.value.toLowerCase();
    tableBody.querySelectorAll("tr").forEach(row => {
        const match = Array.from(row.children).some(td => td.innerText.toLowerCase().includes(filter));
        row.style.display = match ? "" : "none";
    });
});

// Кнопка добавления
addBtn.addEventListener("click", () => {
    window.location.href = "create_write_off.html";
});

// Кнопка редактирования
editBtn.addEventListener("click", () => {
    if (!selectedWriteOffId) {
        alert("Выберите списание для редактирования!");
        return;
    }
    window.location.href = `edit_write_off.html?id=${selectedWriteOffId}`;
});

// Кнопка удаления
deleteBtn.addEventListener("click", async () => {
    if (!selectedWriteOffId) {
        alert("Выберите списание для удаления!");
        return;
    }

    if (!confirm('Вы уверены, что хотите удалить это списание?')) {
        return;
    }

    try {
        const response = await fetch(`/api/writeoffs/${selectedWriteOffId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Ошибка удаления списания');
        }

        alert('Списание успешно удалено!');
        loadWriteOffs();
        selectedWriteOffId = null;

    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('Ошибка удаления: ' + error.message);
    }
});

// ------------------------- Сортировка -------------------------
document.querySelectorAll("#write_offTable th").forEach((th, index) => {
    const arrow = document.createElement("span");
    arrow.classList.add("sort-arrow");
    arrow.innerHTML = "&#9650;"; // ▲
    th.appendChild(arrow);

    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
        const rowsArray = Array.from(tableBody.querySelectorAll("tr"));
        const ascending = !th.asc;
        th.asc = ascending;

        // Убираем стрелки у всех, добавляем текущей
        document.querySelectorAll("#write_offTable th").forEach(h => h.classList.remove("asc", "desc"));
        th.classList.add(ascending ? "asc" : "desc");

        rowsArray.sort((a, b) => {
            const aText = a.children[index]?.innerText || "";
            const bText = b.children[index]?.innerText || "";
            return ascending
                ? aText.localeCompare(bText, 'ru', { numeric: true })
                : bText.localeCompare(aText, 'ru', { numeric: true });
        });

        rowsArray.forEach(r => tableBody.appendChild(r));
    });
});

// Загрузка при старте
loadWriteOffs();