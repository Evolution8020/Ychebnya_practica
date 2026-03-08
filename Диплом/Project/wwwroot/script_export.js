// =====================================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// =====================================================
let currentData = [];
let currentReportType = 'production';

// =====================================================
// ИНИЦИАЛИЗАЦИЯ
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Устанавливаем даты по умолчанию (текущий месяц)
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    document.getElementById('dateFrom').value = formatDateForInput(firstDay);
    document.getElementById('dateTo').value = formatDateForInput(today);

    // Загружаем справочники
    await Promise.all([
        loadWarehouses(),
        loadDepartments(),
        loadNomenclatures()
    ]);

    // Обработчики
    setupEventListeners();

    // Загружаем данные для предпросмотра
    await loadPreviewData();
});

// =====================================================
// ЗАГРУЗКА СПРАВОЧНИКОВ
// =====================================================
async function loadWarehouses() {
    try {
        const response = await fetch('/api/warehouses');
        const warehouses = await response.json();
        
        const select = document.getElementById('warehouseSelect');
        select.innerHTML = '<option value="">Все склады</option>';
        
        warehouses.forEach(w => {
            const option = document.createElement('option');
            option.value = w.id;
            option.textContent = w.name;
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Ошибка загрузки складов:', err);
    }
}

async function loadDepartments() {
    try {
        const response = await fetch('/api/departments');
        const departments = await response.json();
        
        const select = document.getElementById('departmentSelect');
        select.innerHTML = '<option value="">Все подразделения</option>';
        
        departments.forEach(d => {
            const option = document.createElement('option');
            option.value = d.id;
            option.textContent = d.name;
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Ошибка загрузки подразделений:', err);
    }
}

async function loadNomenclatures() {
    try {
        const response = await fetch('/api/nomenclatures');
        const nomenclatures = await response.json();
        
        const select = document.getElementById('nomenclatureSelect');
        select.innerHTML = '<option value="">Вся номенклатура</option>';
        
        nomenclatures.forEach(n => {
            const option = document.createElement('option');
            option.value = n.id;
            option.textContent = n.name;
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Ошибка загрузки номенклатуры:', err);
    }
}

// =====================================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// =====================================================
function setupEventListeners() {
    // Выбор типа отчёта
    document.querySelectorAll('input[name="reportType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentReportType = e.target.value;
            updateFilterVisibility();
            loadPreviewData();
        });
    });

    // Кнопка обновления предпросмотра
    document.getElementById('refreshPreviewBtn').addEventListener('click', loadPreviewData);

    // Кнопки экспорта
    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
    document.getElementById('exportPdfBtn').addEventListener('click', exportToPdf);

    // Автообновление при изменении фильтров
    ['warehouseSelect', 'departmentSelect', 'nomenclatureSelect', 'dateFrom', 'dateTo'].forEach(id => {
        document.getElementById(id).addEventListener('change', loadPreviewData);
    });
}

function updateFilterVisibility() {
    const departmentGroup = document.getElementById('departmentGroup');
    const nomenclatureRow = document.getElementById('nomenclatureRow');

    if (currentReportType === 'production') {
        departmentGroup.style.display = 'flex';
        nomenclatureRow.style.display = 'none';
    } else {
        departmentGroup.style.display = 'none';
        nomenclatureRow.style.display = 'flex';
    }
}

// =====================================================
// ЗАГРУЗКА ДАННЫХ ДЛЯ ПРЕДПРОСМОТРА
// =====================================================
async function loadPreviewData() {
    const container = document.querySelector('.preview-section');
    container.classList.add('loading');

    try {
        if (currentReportType === 'production') {
            await loadProductionData();
        } else {
            await loadStockData();
        }
    } catch (err) {
        console.error('Ошибка загрузки данных:', err);
        showNoData('Ошибка загрузки данных');
    } finally {
        container.classList.remove('loading');
    }
}

async function loadProductionData() {
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const warehouseId = document.getElementById('warehouseSelect').value;
    const departmentId = document.getElementById('departmentSelect').value;

    const response = await fetch('/api/productionreport');
    let data = await response.json();

    // Фильтрация по датам
    if (dateFrom) {
        data = data.filter(r => new Date(r.date) >= new Date(dateFrom));
    }
    if (dateTo) {
        data = data.filter(r => new Date(r.date) <= new Date(dateTo + 'T23:59:59'));
    }

    // Фильтрация по складу и подразделению (если есть такие поля)
    // API возвращает DepartmentName и WarehouseName, поэтому фильтруем по ним
    
    currentData = data;
    renderProductionTable(data);
}

async function loadStockData() {
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const warehouseId = document.getElementById('warehouseSelect').value;
    const nomenclatureId = document.getElementById('nomenclatureSelect').value;

    const params = new URLSearchParams();
    if (warehouseId) params.append('warehouseId', warehouseId);
    if (nomenclatureId) params.append('nomenclatureId', nomenclatureId);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);

    const response = await fetch('/api/warehousemovements?' + params.toString());
    const data = await response.json();

    currentData = data;
    renderStockTable(data);
}

// =====================================================
// РЕНДЕРИНГ ТАБЛИЦ
// =====================================================
function renderProductionTable(data) {
    const thead = document.querySelector('#previewTable thead');
    const tbody = document.querySelector('#previewTable tbody');

    thead.innerHTML = `
        <tr>
            <th>№ документа</th>
            <th>Дата</th>
            <th>Подразделение</th>
            <th>Склад</th>
            <th>Ответственный</th>
            <th>Комментарий</th>
        </tr>
    `;

    if (data.length === 0) {
        showNoData('Нет данных за выбранный период');
        return;
    }

    tbody.innerHTML = data.map(r => `
        <tr>
            <td>${r.doc_number || '—'}</td>
            <td>${formatDate(r.date)}</td>
            <td>${r.DepartmentName || r.departmentName || '—'}</td>
            <td>${r.WarehouseName || r.warehouseName || '—'}</td>
            <td>${r.ResponsibleName || r.responsibleName || r.responsible || '—'}</td>
            <td>${r.comment || '—'}</td>
        </tr>
    `).join('');

    document.getElementById('recordCount').textContent = `Записей: ${data.length}`;
}

function renderStockTable(data) {
    const thead = document.querySelector('#previewTable thead');
    const tbody = document.querySelector('#previewTable tbody');

    thead.innerHTML = `
        <tr>
            <th>Склад</th>
            <th>Номенклатура</th>
            <th>Нач. остаток</th>
            <th>Поступление</th>
            <th>Расход</th>
            <th>Кон. остаток</th>
            <th>Комментарий</th>
        </tr>
    `;

    if (data.length === 0) {
        showNoData('Нет данных за выбранный период');
        return;
    }

    tbody.innerHTML = data.map(r => `
        <tr>
            <td>${r.WarehouseName || r.warehouseName || '—'}</td>
            <td>${r.NomenclatureName || r.nomenclatureName || '—'}</td>
            <td>${r.initial_balance ?? 0}</td>
            <td>${r.incoming ?? 0}</td>
            <td>${r.outgoing ?? 0}</td>
            <td>${r.final_balance ?? 0}</td>
            <td>${r.comment || '—'}</td>
        </tr>
    `).join('');

    document.getElementById('recordCount').textContent = `Записей: ${data.length}`;
}

function showNoData(message) {
    const tbody = document.querySelector('#previewTable tbody');
    tbody.innerHTML = `<tr><td colspan="7" class="no-data">${message}</td></tr>`;
    document.getElementById('recordCount').textContent = 'Записей: 0';
}

// =====================================================
// ЭКСПОРТ В EXCEL
// =====================================================
function exportToExcel() {
    if (currentData.length === 0) {
        alert('Нет данных для экспорта');
        return;
    }

    let headers, rows;
    let filename;

    if (currentReportType === 'production') {
        headers = ['№ документа', 'Дата', 'Подразделение', 'Склад', 'Ответственный', 'Комментарий'];
        rows = currentData.map(r => [
            r.doc_number || '',
            formatDate(r.date),
            r.DepartmentName || r.departmentName || '',
            r.WarehouseName || r.warehouseName || '',
            r.ResponsibleName || r.responsibleName || r.responsible || '',
            r.comment || ''
        ]);
        filename = `Отчёт_производства_${getDateString()}.xlsx`;
    } else {
        headers = ['Склад', 'Номенклатура', 'Нач. остаток', 'Поступление', 'Расход', 'Кон. остаток', 'Комментарий'];
        rows = currentData.map(r => [
            r.WarehouseName || r.warehouseName || '',
            r.NomenclatureName || r.nomenclatureName || '',
            r.initial_balance ?? 0,
            r.incoming ?? 0,
            r.outgoing ?? 0,
            r.final_balance ?? 0,
            r.comment || ''
        ]);
        filename = `Ведомость_по_товарам_${getDateString()}.xlsx`;
    }

    // Создаём workbook
    const wb = XLSX.utils.book_new();
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Устанавливаем ширину столбцов
    const colWidths = headers.map(h => ({ wch: Math.max(h.length, 15) }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Отчёт');
    XLSX.writeFile(wb, filename);
}

// =====================================================
// ЭКСПОРТ В PDF (используем pdfmake с поддержкой кириллицы)
// =====================================================
function exportToPdf() {
    if (currentData.length === 0) {
        alert('Нет данных для экспорта');
        return;
    }

    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const periodText = 'Период: ' + (dateFrom ? formatDate(dateFrom) : 'не указано') + ' — ' + (dateTo ? formatDate(dateTo) : 'не указано');

    // Заголовок отчёта
    const title = currentReportType === 'production' 
        ? 'Отчёт производства' 
        : 'Ведомость по товарам на складах';

    // Формируем заголовки и данные таблицы
    let tableHeaders, tableBody;

    if (currentReportType === 'production') {
        tableHeaders = ['№ док.', 'Дата', 'Подразделение', 'Склад', 'Ответственный', 'Комментарий'];
        tableBody = currentData.map(r => [
            r.doc_number || '',
            formatDate(r.date),
            r.DepartmentName || r.departmentName || '',
            r.WarehouseName || r.warehouseName || '',
            r.ResponsibleName || r.responsibleName || r.responsible || '',
            (r.comment || '').substring(0, 30)
        ]);
    } else {
        tableHeaders = ['Склад', 'Номенклатура', 'Нач. остаток', 'Поступило', 'Расход', 'Кон. остаток', 'Комментарий'];
        tableBody = currentData.map(r => [
            r.WarehouseName || r.warehouseName || '',
            r.NomenclatureName || r.nomenclatureName || '',
            String(r.initial_balance ?? 0),
            String(r.incoming ?? 0),
            String(r.outgoing ?? 0),
            String(r.final_balance ?? 0),
            (r.comment || '').substring(0, 20)
        ]);
    }

    // Создаём заголовок таблицы с синим фоном
    const headerRow = tableHeaders.map(h => ({
        text: h,
        style: 'tableHeader'
    }));

    // Создаём тело таблицы
    const bodyRows = tableBody.map((row, index) => 
        row.map(cell => ({
            text: cell,
            fillColor: index % 2 === 0 ? '#ffffff' : '#f5f7fb'
        }))
    );

    // Определение документа для pdfmake
    const docDefinition = {
        pageOrientation: 'landscape',
        pageSize: 'A4',
        pageMargins: [20, 20, 20, 30],
        
        content: [
            {
                text: title,
                style: 'header',
                margin: [0, 0, 0, 5]
            },
            {
                text: periodText,
                style: 'subheader',
                margin: [0, 0, 0, 15]
            },
            {
                table: {
                    headerRows: 1,
                    widths: currentReportType === 'production' 
                        ? [50, 60, '*', '*', '*', '*']
                        : ['*', '*', 50, 50, 50, 50, '*'],
                    body: [headerRow, ...bodyRows]
                },
                layout: {
                    hLineWidth: function() { return 0.5; },
                    vLineWidth: function() { return 0.5; },
                    hLineColor: function() { return '#d1d5db'; },
                    vLineColor: function() { return '#d1d5db'; },
                    paddingLeft: function() { return 6; },
                    paddingRight: function() { return 6; },
                    paddingTop: function() { return 4; },
                    paddingBottom: function() { return 4; }
                }
            },
            {
                text: '\nВсего записей: ' + currentData.length,
                style: 'footer',
                margin: [0, 10, 0, 0]
            },
            {
                text: 'Дата формирования: ' + new Date().toLocaleString('ru-RU'),
                style: 'footer'
            }
        ],
        
        styles: {
            header: {
                fontSize: 16,
                bold: true,
                color: '#1f2937'
            },
            subheader: {
                fontSize: 10,
                color: '#6b7280'
            },
            tableHeader: {
                bold: true,
                fontSize: 9,
                color: 'white',
                fillColor: '#0a4da3'
            },
            footer: {
                fontSize: 9,
                color: '#6b7280'
            }
        },
        
        defaultStyle: {
            fontSize: 9,
            color: '#374151'
        }
    };

    // Имя файла
    const filename = currentReportType === 'production' 
        ? 'Otchet_proizvodstva_' + getDateString() + '.pdf'
        : 'Vedomost_po_tovaram_' + getDateString() + '.pdf';

    // Генерируем и скачиваем PDF
    pdfMake.createPdf(docDefinition).download(filename);
}

// =====================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =====================================================
function formatDate(dateString) {
    if (!dateString) return '—';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU');
    } catch {
        return '—';
    }
}

function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

