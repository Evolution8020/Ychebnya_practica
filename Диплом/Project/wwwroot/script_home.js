// =====================================================
// ГЛАВНАЯ СТРАНИЦА - DASHBOARD
// =====================================================

let productionChart = null;
let stockChart = null;

document.addEventListener("DOMContentLoaded", () => {
    loadAllData();
    
    // Обновляем время
    updateTime();
    setInterval(updateTime, 1000);
    
    // Автообновление каждые 5 минут
    setInterval(loadAllData, 5 * 60 * 1000);
});

// =================== ЗАГРУЗКА ВСЕХ ДАННЫХ ===================
async function loadAllData() {
    try {
        // Загружаем все данные параллельно
        const [
            productionReports,
            receipts,
            writeoffs,
            movements,
            nomenclatures,
            warehouses,
            counterparties
        ] = await Promise.all([
            fetchData('/api/productionreport'),
            fetchData('/api/receipts'),
            fetchData('/api/writeoffs'),
            fetchData('/api/warehousemovements'),
            fetchData('/api/nomenclatures'),
            fetchData('/api/warehouses'),
            fetchData('/api/counterparties')
        ]);

        // Обновляем карточки
        updateMainCards(productionReports, receipts, writeoffs, movements);
        updateSecondaryCards(nomenclatures, warehouses, productionReports, counterparties);
        
        // Обновляем таблицы
        updateProductionTable(productionReports);
        updateReceiptsTable(receipts);
        
        // Обновляем графики
        updateProductionChart(productionReports);
        updateStockChart(movements, warehouses);

    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    }
}

// =================== FETCH HELPER ===================
async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`Ошибка загрузки ${url}:`, error);
        return [];
    }
}

// =================== ОСНОВНЫЕ КАРТОЧКИ ===================
function updateMainCards(production, receipts, writeoffs, movements) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Произведено сегодня (количество отчётов за сегодня)
    const todayProduction = production.filter(p => {
        const date = new Date(p.date);
        date.setHours(0, 0, 0, 0);
        return date.getTime() === today.getTime();
    }).length;
    
    updateCard('production-today', todayProduction + ' отч.');

    // Остатки на складах (сумма конечных остатков)
    const totalStock = calculateTotalStock(movements);
    updateCard('stock', formatNumber(totalStock) + ' ед.');

    // Поступления за месяц
    const monthlyReceipts = receipts
        .filter(r => new Date(r.date) >= monthStart)
        .reduce((sum, r) => sum + (r.totalSum || 0), 0);
    updateCard('receipts', formatNumber(monthlyReceipts) + ' ₽');

    // Списано за месяц
    const monthlyWriteoffs = writeoffs
        .filter(w => new Date(w.date) >= monthStart)
        .reduce((sum, w) => sum + (w.totalQuantity || 0), 0);
    updateCard('writeoffs', formatNumber(monthlyWriteoffs) + ' ед.');
}

function calculateTotalStock(movements) {
    // Группируем по складу и номенклатуре, берём последнюю запись
    const latest = new Map();

    movements.forEach(m => {
        const key = `${m.WarehouseName || m.warehouseName}_${m.NomenclatureName || m.nomenclatureName}`;
        const existing = latest.get(key);

        if (!existing || new Date(m.Date || m.date) > new Date(existing.Date || existing.date)) {
            latest.set(key, m);
        }
    });
    
    return Array.from(latest.values())
        .reduce((sum, m) => sum + (m.final_balance || 0), 0);
}

// =================== ДОПОЛНИТЕЛЬНЫЕ КАРТОЧКИ ===================
function updateSecondaryCards(nomenclatures, warehouses, production, counterparties) {
    updateCard('nomenclature-count', nomenclatures.length);
    updateCard('warehouses-count', warehouses.length);
    updateCard('reports-count', production.length);
    updateCard('counterparties-count', counterparties.length);
}

// =================== ОБНОВЛЕНИЕ КАРТОЧКИ ===================
function updateCard(type, value) {
    const card = document.querySelector(`.card[data-type="${type}"] .card-value`);
    if (card) {
        card.textContent = value;
    }
}

// =================== ТАБЛИЦА ПРОИЗВОДСТВА ===================
function updateProductionTable(production) {
    const tbody = document.getElementById('productionTable');
    if (!tbody) return;

    // Берём последние 5 записей
    const recent = production
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

    if (recent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-row">Нет данных</td></tr>';
        return;
    }

    tbody.innerHTML = recent.map(r => `
        <tr>
            <td><strong>${escapeHtml(r.doc_number || '—')}</strong></td>
            <td>${formatDate(r.date)}</td>
            <td>${escapeHtml(r.DepartmentName || r.departmentName || '—')}</td>
            <td>${escapeHtml(r.WarehouseName || r.warehouseName || '—')}</td>
        </tr>
    `).join('');
}

// =================== ТАБЛИЦА ПОСТУПЛЕНИЙ ===================
function updateReceiptsTable(receipts) {
    const tbody = document.getElementById('receiptsTable');
    if (!tbody) return;

    // Берём последние 5 записей
    const recent = receipts
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

    if (recent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-row">Нет данных</td></tr>';
        return;
    }

    tbody.innerHTML = recent.map(r => `
        <tr>
            <td><strong>${escapeHtml(r.doc_number || '—')}</strong></td>
            <td>${formatDate(r.date)}</td>
            <td>${escapeHtml(r.counterpartyName || '—')}</td>
            <td>${formatNumber(r.totalSum || 0)} ₽</td>
        </tr>
    `).join('');
}

// =================== ГРАФИК ПРОИЗВОДСТВА ===================
function updateProductionChart(production) {
    const ctx = document.getElementById('productionChart');
    if (!ctx) return;

    // Последние 7 дней
    const days = [];
    const counts = [];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const dayName = date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' });
        days.push(dayName);
        
        const count = production.filter(p => {
            const pDate = new Date(p.date);
            pDate.setHours(0, 0, 0, 0);
            return pDate.getTime() === date.getTime();
        }).length;
        
        counts.push(count);
    }

    if (productionChart) {
        productionChart.destroy();
    }

    productionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: days,
            datasets: [{
                label: 'Отчётов производства',
                data: counts,
                backgroundColor: 'rgba(16, 185, 129, 0.8)',
                borderColor: 'rgb(16, 185, 129)',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// =================== ГРАФИК ОСТАТКОВ ПО СКЛАДАМ ===================
function updateStockChart(movements, warehouses) {
    const ctx = document.getElementById('stockChart');
    if (!ctx) return;

    // Группируем остатки по складам
    const stockByWarehouse = new Map();
    
    // Инициализируем склады
    warehouses.forEach(w => {
        stockByWarehouse.set(w.name, 0);
    });

    // Получаем последние остатки для каждой позиции
    const latest = new Map();
    movements.forEach(m => {
        const whName = m.WarehouseName || m.warehouseName;
        const nomName = m.NomenclatureName || m.nomenclatureName;
        const key = `${whName}_${nomName}`;
        const existing = latest.get(key);
        
        if (!existing || new Date(m.Date || m.date) > new Date(existing.Date || existing.date)) {
            latest.set(key, m);
        }
    });

    // Суммируем остатки по складам
    latest.forEach(m => {
        const whName = m.WarehouseName || m.warehouseName;
        const current = stockByWarehouse.get(whName) || 0;
        stockByWarehouse.set(whName, current + (m.final_balance || 0));
    });

    const labels = Array.from(stockByWarehouse.keys());
    const data = Array.from(stockByWarehouse.values());

    // Цвета для графика
    const colors = [
        'rgba(59, 130, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(245, 158, 11, 0.8)',
        'rgba(139, 92, 246, 0.8)',
        'rgba(239, 68, 68, 0.8)',
        'rgba(14, 165, 233, 0.8)'
    ];

    if (stockChart) {
        stockChart.destroy();
    }

    stockChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: 'white',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

// =================== ОТОБРАЖЕНИЕ ВРЕМЕНИ (Екатеринбург, UTC+5) ===================
function updateTime() {
    const timeElement = document.getElementById('currentTime');
    if (!timeElement) return;

    // Получаем текущее время в UTC
    const now = new Date();
    
    // Екатеринбург UTC+5
    const ekaterinburgOffset = 5 * 60; // 5 часов в минутах
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const ekaterinburgTime = new Date(utcTime + (ekaterinburgOffset * 60000));

    // Форматируем время
    const hours = String(ekaterinburgTime.getHours()).padStart(2, '0');
    const minutes = String(ekaterinburgTime.getMinutes()).padStart(2, '0');
    const seconds = String(ekaterinburgTime.getSeconds()).padStart(2, '0');
    
    const day = String(ekaterinburgTime.getDate()).padStart(2, '0');
    const month = String(ekaterinburgTime.getMonth() + 1).padStart(2, '0');
    const year = ekaterinburgTime.getFullYear();

    const timeString = `${hours}:${minutes}:${seconds}`;
    const dateString = `${day}.${month}.${year}`;
    
    timeElement.textContent = `${dateString} ${timeString} (Екатеринбург)`;
}


// =================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===================
function formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatNumber(num) {
    return num.toLocaleString('ru-RU');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
