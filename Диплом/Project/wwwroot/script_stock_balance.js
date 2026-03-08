async function loadWarehouses() {
    const select = document.querySelector("#warehouseSelect");
    select.innerHTML = `<option value="">-- Выберите склад --</option>`;
    const response = await fetch("/api/warehouses");
    const data = await response.json();
    data.forEach(w => {
        const option = document.createElement("option");
        option.value = w.id;
        option.textContent = w.name;
        select.appendChild(option);
    });
}

async function loadNomenclature() {
    const select = document.querySelector("#nomenclatureSelect");
    select.innerHTML = `<option value="">-- Выберите номенклатуру --</option>`;
    const response = await fetch("/api/nomenclatures");
    const data = await response.json();
    data.forEach(n => {
        const option = document.createElement("option");
        option.value = n.id;
        option.textContent = n.name;
        select.appendChild(option);
    });
}

async function loadBalance() {
    let warehouseId = document.querySelector("#warehouseSelect").value;
    let nomenclatureId = document.querySelector("#nomenclatureSelect").value;
    let dateFrom = document.querySelector("#dateFrom").value;
    let dateTo = document.querySelector("#dateTo").value;

    if (dateFrom && dateTo) {
        const from = new Date(dateFrom);
        const to = new Date(dateTo);
        if (from > to) {
            alert("Дата начала не может быть позже даты окончания");
            return;
        }
    }

    console.log("Фильтры:", { warehouseId, nomenclatureId, dateFrom, dateTo });

    const params = new URLSearchParams();
    if (warehouseId) params.append("warehouseId", warehouseId);
    if (nomenclatureId) params.append("nomenclatureId", nomenclatureId);
    if (dateFrom) params.append("dateFrom", dateFrom);
    if (dateTo) params.append("dateTo", dateTo);

    const response = await fetch('/api/warehousemovements?' + params.toString());
    const balance = await response.json();

    console.log("Ответ API:", balance);
    balance.forEach(r => console.log("Дата движения:", r.date));

    const tbody = document.querySelector("#reportTable tbody");
    tbody.innerHTML = "";

    balance.forEach(report => {
        let row = document.createElement("tr");
        // Форматируем дату для отображения
        let dateStr = report.date || report.Date || "";
        if (dateStr) {
            try {
                const date = new Date(dateStr);
                if (!isNaN(date.getTime())) {
                    dateStr = date.toLocaleDateString('ru-RU');
                }
            } catch (e) {
                // Оставляем как есть, если не удалось распарсить
            }
        }
        row.innerHTML = `
            <td>${report.warehouseName ?? ""}</td>
            <td>${report.nomenclatureName ?? ""}</td>
            <td>${report.initial_balance ?? 0}</td>
            <td>${report.incoming ?? 0}</td>
            <td>${report.outgoing ?? 0}</td>
            <td>${report.final_balance ?? 0}</td>
            <td>${report.comment ?? ""}</td>
            <td>${dateStr}</td>
        `;
        tbody.appendChild(row);
    });
}



window.addEventListener("DOMContentLoaded", () => {
    loadWarehouses();
    loadNomenclature();
});

document.querySelector("#generateBtn").addEventListener("click", loadBalance);
