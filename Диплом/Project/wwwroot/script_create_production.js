// =====================================================
// ГЛОБАЛЬНЫЕ ДАННЫЕ
// =====================================================
let nomenclatures = [];


// =====================================================
// ГЕНЕРАЦИЯ НОМЕРА ДОКУМЕНТА
// =====================================================
async function generateDocNumber() {
    try {
        const response = await fetch('/api/productionreport');
        if (!response.ok) throw new Error('Ошибка загрузки');
        
        const reports = await response.json();
        
        // Находим максимальный номер
        let maxNumber = 0;
        
        reports.forEach(r => {
            if (r.doc_number) {
                // Извлекаем число из номера (может быть в формате 0000001 или просто число)
                const numMatch = r.doc_number.match(/(\d+)/);
                if (numMatch) {
                    const num = parseInt(numMatch[1]);
                    if (num > maxNumber) {
                        maxNumber = num;
                    }
                }
            }
        });
        
        // Следующий номер в формате 0000001 (7 цифр)
        const nextNumber = maxNumber + 1;
        return String(nextNumber).padStart(7, '0');
        
    } catch (error) {
        console.error('Ошибка генерации номера:', error);
        // Если не удалось получить данные, возвращаем 0000001
        return '0000001';
    }
}

// =====================================================
// ЗАГРУЗКА ДАННЫХ
// =====================================================
async function loadNomenclatures() {
    try {
        const res = await fetch("/api/nomenclatures");
        if (!res.ok) throw new Error("Ошибка загрузки номенклатуры");
        nomenclatures = await res.json();
        console.log("Номенклатура загружена:", nomenclatures.length);
    } catch (err) {
        console.error(err);
        alert("Ошибка загрузки номенклатуры");
    }
}

async function loadDepartments() {
    const select = document.getElementById("departmentSelect");
    if (!select) return;

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
        console.error("Ошибка загрузки подразделений:", err);
        alert("Не удалось загрузить подразделения");
    }
}

async function loadWarehouses() {
    const select = document.getElementById("warehouseSelect");
    if (!select) return;

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
        console.error("Ошибка загрузки складов:", err);
        alert("Не удалось загрузить склады");
    }
}


// =====================================================
// ДОБАВЛЕНИЕ ПРОДУКТА (ГОТОВАЯ ПРОДУКЦИЯ)
// =====================================================
function addProductRow() {
    const tableBody = document.getElementById("productsTableBody");
    if (!tableBody) return;

    const optionsHtml = nomenclatures
        .filter(n => {
            const type = (n.type || "").toLowerCase();
            return type.includes("готовая продукция") || type.includes("готов");
        })
        .map(n => `<option value="${n.id}" data-unit="${n.base_unit || ''}">${n.name}</option>`)
        .join("");

    const row = document.createElement("tr");
    row.className = "added-row";

    row.innerHTML = `
        <td>
            <select class="product-select">
                <option value="">Выберите продукт</option>
                ${optionsHtml}
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

    productSelect.addEventListener("change", () => {
        const option = productSelect.options[productSelect.selectedIndex];
        unitInput.value = option.dataset.unit || "";
        row.dataset.productId = option.value || "";
    });

    row.querySelector(".delete-btn").addEventListener("click", () => row.remove());
}


// =====================================================
// ДОБАВЛЕНИЕ МАТЕРИАЛА (сырье / материал)
// =====================================================
function addMaterialRow() {
    const tableBody = document.getElementById("materialsTableBody");
    if (!tableBody) return;

    const optionsHtml = nomenclatures
        .filter(n =>
            (n.type || "").toLowerCase().includes("сырье") ||
            (n.type || "").toLowerCase().includes("материал")
        )
        .map(n => `<option value="${n.id}" data-unit="${n.base_unit || ''}">${n.name}</option>`)
        .join("");

    const row = document.createElement("tr");

    row.innerHTML = `
        <td>
            <select class="material-select">
                <option value="">Выберите материал</option>
                ${optionsHtml}
            </select>
        </td>

        <td><input type="number" class="qty-input" step="0.01" min="0"></td>
        <td><input type="text" class="unit-input" readonly></td>

        <td><button class="delete-btn">Удалить</button></td>
    `;

    tableBody.appendChild(row);

    const select = row.querySelector(".material-select");
    const unitInput = row.querySelector(".unit-input");

    select.addEventListener("change", () => {
        const option = select.options[select.selectedIndex];
        unitInput.value = option.dataset.unit || "";
    });

    row.querySelector(".delete-btn").addEventListener("click", () => row.remove());
}


// =====================================================
// СОХРАНЕНИЕ ОТЧЁТА
// =====================================================
async function saveProductionReport() {

    console.log("=== СОХРАНЕНИЕ ОТЧЁТА ===");

    const departmentId = parseInt(document.getElementById("departmentSelect").value);
    const warehouseId = parseInt(document.getElementById("warehouseSelect").value);
    const responsible = document.getElementById("responsible").value;
    const productionDate = document.getElementById("productionDate").value;
    const comment = document.getElementById("productionComment").value || "";
    const doc_number = document.getElementById("docNumber").value;

    if (!departmentId || !warehouseId || !responsible || !productionDate) {
        alert("Заполните обязательные поля");
        return;
    }

    // ---- ПРОДУКЦИЯ ----
    const products = [];
    document.querySelectorAll("#productsTableBody tr.added-row").forEach(row => {
        const productId = parseInt(row.dataset.productId);
        const qty = parseFloat(row.querySelector(".qty-input").value);
        const batch = parseInt(row.querySelector(".batch-input").value) || 0;
        const shelf_life = parseInt(row.querySelector(".expire-input").value) || 0;

        if (productId && qty > 0) {
            products.push({
                product_id: productId,
                quantity: qty,
                batch_number: batch,
                shelf_life: shelf_life
            });
        }
    });

    if (products.length === 0) {
        alert("Добавьте хотя бы один продукт");
        return;
    }

    // ---- МАТЕРИАЛЫ ----
    const materials = [];
    document.querySelectorAll("#materialsTableBody tr").forEach(row => {
        const sel = row.querySelector(".material-select");
        const qty = parseFloat(row.querySelector(".qty-input").value);

        if (sel && sel.value && qty > 0) {
            materials.push({
                material_id: parseInt(sel.value),
                quantity: qty
            });
        }
    });

    if (materials.length === 0) {
        alert("Добавьте хотя бы один материал");
        return;
    }

    // ---- ИТОГО ----
    const payload = {
        doc_number,
        department_id: departmentId,
        warehouse_id: warehouseId,
        responsible,
        date: productionDate,
        comment,
        products,
        materials
    };

    console.log("Отправляем:", payload);

    try {
        const res = await fetch("/api/productionreports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const text = await res.text();
        console.log("Ответ сервера:", text);

        if (!res.ok) throw new Error(text);

        alert("Отчёт сохранён!");
        window.location.reload();
        window.history.back(); 

    } catch (err) {
        console.error("Ошибка:", err);
        alert("Ошибка сохранения: " + err.message);
    }
}


// =====================================================
// DOMContentLoaded
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
    await loadNomenclatures();
    await loadDepartments();
    await loadWarehouses();

    // Автогенерация номера документа
    const docNumber = await generateDocNumber();
    document.getElementById("docNumber").value = docNumber;

    // Установка текущей даты
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("productionDate").value = today;

    // Автозаполнение поля "Ответственный" из данных текущего пользователя
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.full_name) {
        document.getElementById("responsible").value = user.full_name;
    }

    document.getElementById("addProductBtn").addEventListener("click", addProductRow);
    document.getElementById("addMaterialBtn").addEventListener("click", addMaterialRow);
    document.getElementById("saveReportBtn").addEventListener("click", saveProductionReport);
});
