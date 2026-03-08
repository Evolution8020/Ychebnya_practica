const tableBody = document.querySelector("#nomenclatureTable tbody");
const addBtn = document.getElementById("#addBtn")
const editBtn = document.getElementById("#editBtn")
const deleteBtn = document.getElementById("#deleteBtn")
const saveBtn = document.getElementById("#saveBtn")
const modal = document.getElementById("nomenclatureModal");
const closeModal = document.querySelector(".close-modal");
const searchInput = document.getElementById("searchInput");
const modalTitle = document.getElementById("modalTitle");



let editingRow = null; // null = добавление новой записи






// Функция генерации номера
function generateItemNumber() {
    const rows = tableBody.querySelectorAll("tr");
    let maxNumber = 0;

    rows.forEach(row => {
        const numText = row.children[0].innerText; // берём первый td — номер
        const num = parseInt(numText, 10);        // превращаем в число
        if (!isNaN(num) && num > maxNumber) maxNumber = num;
    });

    return String(maxNumber + 1).padStart(6, "0"); // формат 000001, 000002...
}

// Функция загрузки данных с БД
async function loadNomenclatures() {
    try {
        const response = await fetch("/api/nomenclatures");
        if (!response.ok) throw new Error("Ошибка загрузки данных");

        const nomenclatures = await response.json();
        tableBody.innerHTML = "";

        // Группируем по group_name
        const groups = {};
        const itemsWithoutGroup = [];

        nomenclatures.forEach(item => {
            if (item.group_name && item.group_name.trim()) {
                if (!groups[item.group_name]) {
                    groups[item.group_name] = [];
                }
                groups[item.group_name].push(item);
            } else {
                itemsWithoutGroup.push(item);
            }
        });

        // Сортируем группы по алфавиту
        const sortedGroups = Object.keys(groups).sort();

        // Отображаем группы
        sortedGroups.forEach(groupName => {
            // Строка группы
            const groupRow = document.createElement("tr");
            groupRow.className = "group-row";
            groupRow.dataset.group = groupName;
            groupRow.innerHTML = `
                <td colspan="5">
                    <span class="group-icon">▶</span>
                    ${groupName}
                </td>
            `;
            tableBody.appendChild(groupRow);

            // Обработчик клика на группу
            groupRow.addEventListener("click", (e) => {
                if (e.target.closest('.group-icon') || e.target.closest('td')) {
                    const isExpanded = groupRow.classList.contains("expanded");
                    groupRow.classList.toggle("expanded");
                    
                    // Показываем/скрываем элементы группы
                    const groupItems = tableBody.querySelectorAll(`tr.group-item[data-group="${groupName}"]`);
                    groupItems.forEach(item => {
                        if (isExpanded) {
                            item.classList.remove("visible");
                        } else {
                            item.classList.add("visible");
                        }
                    });
                }
            });

            // Элементы группы
            groups[groupName].forEach(item => {
                const row = document.createElement("tr");
                row.className = "group-item";
                row.dataset.group = groupName;
                row.dataset.id = item.id;
                row.innerHTML = `
                    <td>${item.number || ""}</td>
                    <td>${item.name}</td>
                    <td>${item.type}</td>
                    <td>${item.base_unit}</td>
                    <td>${item.comment || ""}</td>
                `;
                tableBody.appendChild(row);

                // Выделение строки
                row.addEventListener("click", (e) => {
                    if (!e.target.closest('.group-icon')) {
                        tableBody.querySelectorAll("tr").forEach(r => r.classList.remove("selected"));
                        row.classList.add("selected");
                    }
                });
            });
        });

        // Элементы без группы - создаем группу "Без группы"
        if (itemsWithoutGroup.length > 0) {
            const groupRow = document.createElement("tr");
            groupRow.className = "group-row";
            groupRow.dataset.group = "Без группы";
            groupRow.innerHTML = `
                <td colspan="5">
                    <span class="group-icon">▶</span>
                    Без группы
                </td>
            `;
            tableBody.appendChild(groupRow);

            // Обработчик клика на группу
            groupRow.addEventListener("click", (e) => {
                if (e.target.closest('.group-icon') || e.target.closest('td')) {
                    const isExpanded = groupRow.classList.contains("expanded");
                    groupRow.classList.toggle("expanded");
                    
                    // Показываем/скрываем элементы группы
                    const groupItems = tableBody.querySelectorAll(`tr.group-item[data-group="Без группы"]`);
                    groupItems.forEach(item => {
                        if (isExpanded) {
                            item.classList.remove("visible");
                        } else {
                            item.classList.add("visible");
                        }
                    });
                }
            });

            // Элементы без группы
            itemsWithoutGroup.forEach(item => {
                const row = document.createElement("tr");
                row.className = "group-item";
                row.dataset.group = "Без группы";
                row.dataset.id = item.id;
                row.innerHTML = `
                    <td>${item.number || ""}</td>
                    <td>${item.name}</td>
                    <td>${item.type}</td>
                    <td>${item.base_unit}</td>
                    <td>${item.comment || ""}</td>
                `;
                tableBody.appendChild(row);

                // Выделение строки
                row.addEventListener("click", (e) => {
                    if (!e.target.closest('.group-icon')) {
                        tableBody.querySelectorAll("tr").forEach(r => r.classList.remove("selected"));
                        row.classList.add("selected");
                    }
                });
            });
        }

    } catch (error) {
        alert("Не удалось загрузить записи с данных БД");
        console.error(error);
    }
}

loadNomenclatures();


// Выделение строки (только для обычных строк, не для групп)
tableBody.addEventListener("click", e => {
    const row = e.target.closest("tr");
    if (!row || row.classList.contains("group-row")) return;
    tableBody.querySelectorAll("tr").forEach(r => r.classList.remove("selected"));
    row.classList.add("selected");
});


// Поиск
searchInput.addEventListener("input", () => {
    const filter = searchInput.value.toLowerCase();
    const allRows = tableBody.querySelectorAll("tr");
    
    if (!filter) {
        // Если поиск пустой, показываем все
        allRows.forEach(row => {
            if (row.classList.contains("group-item")) {
                // Элементы групп показываем только если группа раскрыта
                const groupName = row.dataset.group;
                if (groupName) {
                    const groupRow = tableBody.querySelector(`tr.group-row[data-group="${groupName}"]`);
                    if (groupRow && groupRow.classList.contains("expanded")) {
                        row.style.display = "";
                    } else {
                        row.style.display = "none";
                    }
                } else {
                    row.style.display = "";
                }
            } else {
                row.style.display = "";
            }
        });
        return;
    }

    // Логика поиска с учетом групп
    const matchedGroups = new Set();
    
    allRows.forEach(row => {
        if (row.classList.contains("group-row")) {
            const groupName = row.dataset.group;
            const groupItems = tableBody.querySelectorAll(`tr.group-item[data-group="${groupName}"]`);
            let hasMatch = false;
            
            groupItems.forEach(item => {
                const match = Array.from(item.children).some(td => td.innerText.toLowerCase().includes(filter));
                if (match) {
                    hasMatch = true;
                    matchedGroups.add(groupName);
                    item.style.display = "";
                    item.classList.add("visible");
                } else {
                    item.style.display = "none";
                }
            });
            
            // Показываем группу если есть совпадения
            if (hasMatch) {
                row.style.display = "";
                row.classList.add("expanded");
            } else if (groupName.toLowerCase().includes(filter)) {
                row.style.display = "";
                matchedGroups.add(groupName);
            } else {
                row.style.display = "none";
            }
        } else if (row.classList.contains("group-item")) {
            // Уже обработано выше
        } else {
            // Обычные строки без группы
            const match = Array.from(row.children).some(td => td.innerText.toLowerCase().includes(filter));
            row.style.display = match ? "" : "none";
        }
    });
});

// Сортировка по клику (только для обычных строк, группы не сортируются)
const headers = document.querySelectorAll("#nomenclatureTable th");
headers.forEach((th, index) => {
    const arrow = document.createElement("span");
    arrow.classList.add("sort-arrow");
    arrow.innerHTML = "&#9650;"; // ▲
    th.appendChild(arrow);

    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
        // Собираем только обычные строки (не группы и не элементы групп)
        const allRows = Array.from(tableBody.querySelectorAll("tr"));
        const groupRows = allRows.filter(r => r.classList.contains("group-row"));
        const groupItems = allRows.filter(r => r.classList.contains("group-item"));
        const regularRows = allRows.filter(r => !r.classList.contains("group-row") && !r.classList.contains("group-item"));
        
        // Сортируем обычные строки
        const ascending = !th.asc;
        th.asc = ascending;
        headers.forEach(h => h.classList.remove("asc"));
        if (!ascending) th.classList.add("asc");

        regularRows.sort((a, b) => {
            const aText = a.children[index]?.innerText.toLowerCase() || "";
            const bText = b.children[index]?.innerText.toLowerCase() || "";
            if (!isNaN(aText) && !isNaN(bText)) return ascending ? aText - bText : bText - aText;
            return ascending ? aText.localeCompare(bText) : bText.localeCompare(aText);
        });

        // Сортируем элементы внутри каждой группы
        const groups = {};
        groupItems.forEach(item => {
            const groupName = item.dataset.group;
            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push(item);
        });

        Object.keys(groups).forEach(groupName => {
            groups[groupName].sort((a, b) => {
                const aText = a.children[index]?.innerText.toLowerCase() || "";
                const bText = b.children[index]?.innerText.toLowerCase() || "";
                if (!isNaN(aText) && !isNaN(bText)) return ascending ? aText - bText : bText - aText;
                return ascending ? aText.localeCompare(bText) : bText.localeCompare(aText);
            });
        });

        // Очищаем таблицу и вставляем отсортированные элементы
        tableBody.innerHTML = "";
        
        // Вставляем группы с их элементами
        groupRows.forEach(groupRow => {
            const groupName = groupRow.dataset.group;
            tableBody.appendChild(groupRow);
            if (groups[groupName]) {
                groups[groupName].forEach(item => {
                    tableBody.appendChild(item);
                });
            }
        });
        
        // Вставляем обычные строки
        regularRows.forEach(row => tableBody.appendChild(row));
    });
});


// Логика удаление записи из таблицы
deleteBtn.addEventListener("click", async () => {
    // Ищем выделенную строку
    const row = tableBody.querySelector("tr.selected");
    if (!row || row.classList.contains("group-row")) {
        alert("Выберите строку для удаления");
        return;
    }

    if (!confirm("Удалить запись?")) return;

    const id = row.dataset.id; // предполагается, что у каждой строки есть data-id

    try {
        const res = await fetch(`/api/nomenclatures/${id}`, { method: "DELETE" });

        if (!res.ok) {
            throw new Error(`Ошибка сервера: ${res.status}`);
        }

        // Перезагружаем таблицу для правильной группировки
        loadNomenclatures();

    } catch (e) {
        console.error(e);
        alert("Ошибка удаления");
    }
});



// Открытие/закрытие модалки
function openModal() {
    modal.style.display = 'flex';
    document.getElementById('groupName').value = '';
    document.getElementById('itemName').value = '';
    document.getElementById('unit').value = 'л';
    document.getElementById('type').value = 'сырье';
    document.getElementById('comment').value = '';

    document.getElementById('itemNumber').value = generateItemNumber();
}

function closeModalFunc() {
    modal.style.display = 'none';
}


addBtn.addEventListener('click', openModal);
closeModal.addEventListener('click', closeModalFunc);


// Вставка строки в таблицу (перезагружаем всю таблицу для правильной группировки)
function addRowToTable(data) {
    loadNomenclatures(); // Перезагружаем для правильной группировки
}

// Сохранение через API

saveBtn.addEventListener('click', async () => {
    const groupName = document.getElementById('groupName').value.trim();
    const name = document.getElementById('itemName').value.trim();
    const unit = document.getElementById('unit').value;
    const type = document.getElementById('type').value;
    const comment = document.getElementById('comment').value;
    const number = document.getElementById('itemNumber').value;

    if (!name) {
        alert('Введите наименование номенклатуры!');
        return;
    }

    const payload = {
        group_name: groupName,
        name: name,
        base_unit: unit,
        type: type,
        comment: comment,
        number: number
    };

    try {
        if (editingRow) {
            // Редактирование
            const id = editingRow.dataset.id;
            const res = await fetch(`/api/nomenclatures/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Ошибка редактирования');

            const updatedItem = await res.json();

            // Перезагружаем таблицу для правильной группировки
            loadNomenclatures();
            editingRow = null; // сбрасываем флаг редактирования
            modalTitle.textContent = 'Добавить номенклатуру';

        } else {
            // Добавление новой записи
            const response = await fetch('/api/nomenclatures', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Ошибка при сохранении');

            const savedItem = await response.json();
            addRowToTable(savedItem);
        }

        closeModalFunc();

    } catch (err) {
        console.error(err);
        alert('Не удалось сохранить запись.');
    }
});

editBtn.addEventListener('click', async () => {
    const row = tableBody.querySelector('tr.selected');
    if (!row) {
        alert('Выберите строку для редактирования');
        return;
    }

    const id = row.dataset.id;

    try {
        // Загружаем актуальные данные с сервера
        const response = await fetch(`/api/nomenclatures/${id}`);
        if (!response.ok) throw new Error("Ошибка загрузки данных");

        const item = await response.json();

        editingRow = row; // запоминаем, какую строку редактируем
        modalTitle.textContent = 'Редактировать номенклатуру';

        // Заполняем модалку данными из БД
        document.getElementById('groupName').value = item.group_name || '';
        document.getElementById('itemName').value = item.name || '';
        document.getElementById('unit').value = item.base_unit || '';
        document.getElementById('type').value = item.type || '';
        document.getElementById('comment').value = item.comment || '';
        document.getElementById('itemNumber').value = item.number || '';

        modal.style.display = 'flex';

    } catch (error) {
        console.error(error);
        alert('Не удалось загрузить данные для редактирования');
    }
});



