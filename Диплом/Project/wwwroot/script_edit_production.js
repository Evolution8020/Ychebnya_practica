// ============================================
// Глобальные данные
// ============================================
let nomenclatures = [];

// ============================================
// Получаем ID отчета из URL
// ============================================
const params = new URLSearchParams(window.location.search);
const reportId = params.get("id");
if (!reportId) {
    alert("ID отчета не указан");
    window.location.href = "production.html";
}

// ============================================
// Загрузка номенклатуры
// ============================================
async function loadNomenclatures() {
    try {
        const res = await fetch("/api/nomenclatures");
        if (!res.ok) throw new Error("Ошибка загрузки номенклатуры");
        nomenclatures = await res.json();
    } catch (err) {
        console.error(err);
        alert("Ошибка загрузки номенклатуры");
    }
}

// ============================================
// Загрузка подразделений и складов
// ============================================
async function loadDepartments() {
    const select = document.getElementById("departmentSelect");
    try {
        const res = await fetch("/api/departments");
        if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
        const departments = await res.json();
        select.innerHTML = `<option value="">-- Выберите подразделение --</option>`;
        departments.forEach(d => {
            const option = document.createElement("option");
            option.value = d.id;
            option.textContent = d.name;
            select.appendChild(option);
        });
    } catch (err) {
        console.error(err);
        alert("Не удалось загрузить подразделения");
    }
}

async function loadWarehouses() {
    const select = document.getElementById("warehouseSelect");
    try {
        const res = await fetch("/api/warehouses");
        if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
        const warehouses = await res.json();
        select.innerHTML = `<option value="">-- Выберите склад --</option>`;
        warehouses.forEach(w => {
            const option = document.createElement("option");
            option.value = w.id;
            option.textContent = w.name;
            select.appendChild(option);
        });
    } catch (err) {
        console.error(err);
        alert("Не удалось загрузить склады");
    }
}

// ============================================
// Вспомогательные функции для форматирования даты и времени
// ============================================
function formatDateForInput(dateString) {
    if (!dateString) return "";

    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "";

        // Форматируем в YYYY-MM-DD для input type="date"
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error('Ошибка форматирования даты:', dateString, e);
        return "";
    }
}

// Функция formatTimeForInput удалена - время больше не используется

// ============================================
// Добавление строки продукции
// ============================================
function addProductRow(data = null) {
    const tableBody = document.getElementById("productsTableBody");
    const row = document.createElement("tr");
    row.className = "added-row";

    const options = nomenclatures
        .filter(n => {
            const type = (n.type || "").toLowerCase();
            return type.includes("готовая продукция") || type.includes("готов");
        })
        .map(n => `<option value="${n.id}" data-unit="${n.base_unit}">${n.name}</option>`)
        .join("");

    row.innerHTML = `
        <td>
            <select class="product-select">
                <option value="">Выберите продукт</option>
                ${options}
            </select>
        </td>
        <td><input type="number" class="qty-input" step="0.01" min="0"></td>
        <td><input type="text" class="unit-input" readonly></td>
        <td><input type="number" class="batch-input" min="0" placeholder="Номер партии"></td>
        <td><input type="number" class="expire-input" min="0" placeholder="Дней"></td>
        <td><button class="delete-btn">Удалить</button></td>
    `;

    tableBody.appendChild(row);

    const productSelect = row.querySelector(".product-select");
    const unitInput = row.querySelector(".unit-input");
    const qtyInput = row.querySelector(".qty-input");
    const batchInput = row.querySelector(".batch-input");
    const expireInput = row.querySelector(".expire-input");

    productSelect.addEventListener("change", () => {
        const option = productSelect.options[productSelect.selectedIndex];
        unitInput.value = option.dataset.unit || "";
        row.dataset.productId = option.value;
    });

    row.querySelector(".delete-btn").addEventListener("click", () => row.remove());

    // Если передан объект data, заполняем значения ПОСЛЕ создания элементов
    if (data) {
        // Устанавливаем значения после небольшой задержки, чтобы DOM успел обновиться
        setTimeout(() => {
            productSelect.value = data.nomenclature_id || "";
            unitInput.value = data.unit || "";
            qtyInput.value = data.quantity || "";
            batchInput.value = data.batch_number || "";
            expireInput.value = data.shelf_life || "";

            row.dataset.productId = data.nomenclature_id;
        }, 10);
    }
}

// ============================================
// Добавление строки материала
// ============================================
function addMaterialRow(data = null) {
    const tableBody = document.getElementById("materialsTableBody");
    const row = document.createElement("tr");

    const options = nomenclatures
        .filter(n => n.type.toLowerCase().includes("сырье") || n.type.toLowerCase().includes("материал"))
        .map(n => `<option value="${n.id}" data-unit="${n.base_unit}">${n.name}</option>`)
        .join("");

    row.innerHTML = `
        <td>
            <select class="material-select">
                <option value="">Выберите материал</option>
                ${options}
            </select>
        </td>
        <td><input type="number" class="qty-input" step="0.01" min="0"></td>
        <td><input type="text" class="unit-input" readonly></td>
        <td><button class="delete-btn">Удалить</button></td>
    `;

    tableBody.appendChild(row);

    const select = row.querySelector(".material-select");
    const unitInput = row.querySelector(".unit-input");
    const qtyInput = row.querySelector(".qty-input");

    select.addEventListener("change", () => {
        const option = select.options[select.selectedIndex];
        unitInput.value = option.dataset.unit || "";
    });

    row.querySelector(".delete-btn").addEventListener("click", () => row.remove());

    if (data) {
        // Устанавливаем значения после небольшой задержки
        setTimeout(() => {
            select.value = data.nomenclature_id || "";
            unitInput.value = data.unit || "";
            qtyInput.value = data.quantity || "";
        }, 10);
    }
}

// ============================================
// Загрузка существующего отчета
// ============================================
async function loadReport(id) {
    try {
        const res = await fetch(`/api/productionreports/${id}`);
        if (!res.ok) throw new Error("Отчет не найден");
        const data = await res.json();

        console.log("Загруженные данные отчета:", data); // Для отладки

        // Заполняем основные поля
        document.getElementById("docNumber").value = data.doc_number || "";
        document.getElementById("productionDate").value = data.date ? formatDateForInput(data.date) : "";
        // Время больше не используется
        document.getElementById("departmentSelect").value = data.department_id || "";
        document.getElementById("warehouseSelect").value = data.warehouse_id || "";
        document.getElementById("responsible").value = data.responsible || "";
        document.getElementById("productionComment").value = data.comment || "";

        // Очищаем таблицы перед добавлением
        document.getElementById("productsTableBody").innerHTML = "";
        document.getElementById("materialsTableBody").innerHTML = "";

        // Добавляем продукты с задержкой чтобы DOM успел обновиться
        if (data.products && data.products.length > 0) {
            setTimeout(() => {
                data.products.forEach(p => addProductRow(p));
            }, 50);
        } else {
            console.log("Нет данных о продуктах");
            // Добавляем пустую строку если нет продуктов
            setTimeout(() => addProductRow(), 50);
        }

        // Добавляем материалы с задержкой
        if (data.materials && data.materials.length > 0) {
            setTimeout(() => {
                data.materials.forEach(m => addMaterialRow(m));
            }, 100);
        } else {
            console.log("Нет данных о материалах");
            // Добавляем пустую строку если нет материалов
            setTimeout(() => addMaterialRow(), 100);
        }

    } catch (err) {
        console.error(err);
        alert("Не удалось загрузить отчет");
    }
}

// ============================================
// Сбор данных формы
// ============================================
function collectReportData() {
    const departmentId = parseInt(document.getElementById("departmentSelect").value);
    const warehouseId = parseInt(document.getElementById("warehouseSelect").value);
    const responsible = document.getElementById("responsible").value || "";
    const productionDate = document.getElementById("productionDate").value;
    const comment = document.getElementById("productionComment").value || "";
    const doc_number = document.getElementById("docNumber").value;

    const products = [];
    document.querySelectorAll("#productsTableBody tr.added-row").forEach(row => {
        const productId = parseInt(row.dataset.productId);
        const qty = parseFloat(row.querySelector(".qty-input").value);
        const batch = parseInt(row.querySelector(".batch-input").value) || 0;
        const shelf_life = parseInt(row.querySelector(".expire-input").value) || 0;

        if (productId && qty > 0) {
            products.push({ 
                nomenclature_id: productId, 
                quantity: qty, 
                batch_number: batch, 
                shelf_life: shelf_life 
            });
        }
    });

    const materials = [];
    document.querySelectorAll("#materialsTableBody tr").forEach(row => {
        const sel = row.querySelector(".material-select");
        const qty = parseFloat(row.querySelector(".qty-input").value);

        if (sel && sel.value && qty > 0) {
            materials.push({ nomenclature_id: parseInt(sel.value), quantity: qty });
        }
    });

    return { doc_number, department_id: departmentId, warehouse_id: warehouseId, responsible, date: productionDate, comment, products, materials };
}

// ============================================
// Сохранение отчета (PUT)
// ============================================
async function saveReport() {
    const payload = collectReportData();

    try {
        const res = await fetch(`/api/productionreports/${reportId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Ошибка при сохранении");

        alert("Отчет успешно обновлен");
        window.location.href = "/production.html"; // переходим на список
    } catch (err) {
        console.error(err);
        alert("Не удалось сохранить отчет: " + err.message);
    }
}

// ============================================
// Инициализация страницы
// ============================================
document.addEventListener("DOMContentLoaded", async () => {
    await loadNomenclatures();
    await loadDepartments();
    await loadWarehouses();
    await loadReport(reportId);

    document.getElementById("addProductBtn").addEventListener("click", () => addProductRow());
    document.getElementById("addMaterialBtn").addEventListener("click", () => addMaterialRow());
    document.getElementById("saveReportBtn").addEventListener("click", saveReport);

    document.getElementById("cancelBtn").addEventListener("click", () => {
        window.location.href = "/production.html"; // кнопка отмены возвращает на список
    });
});