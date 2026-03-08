document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM загружен, инициализация страницы отчетов производства...');

    const productionTable = document.querySelector("#productionTable tbody");
    const addReportBtn = document.getElementById("addReportBtn");
    const editReportBtn = document.getElementById("editReportBtn");
    const deleteReportBtn = document.getElementById("deleteReportBtn");
    const searchInput = document.getElementById("searchInput");

    let selectedReportId = null;

    // Проверка всех необходимых элементов
    console.log('productionTable:', productionTable);
    console.log('addReportBtn:', addReportBtn);
    console.log('editReportBtn:', editReportBtn);
    console.log('deleteReportBtn:', deleteReportBtn);
    console.log('searchInput:', searchInput);

    if (!productionTable) {
        console.error('Таблица productionTable не найдена!');
        return;
    }

    // ------------------------- Загрузка отчетов производства -------------------------
    async function loadProductionReports() {
        try {
            console.log('Загрузка отчетов производства...');
            const response = await fetch("/api/productionreport");

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reports = await response.json();
            console.log("Полученные отчеты:", reports);

            // ВРЕМЕННО: выведем структуру первого отчета для отладки
            if (reports && reports.length > 0) {
                console.log("Структура первого отчета:", Object.keys(reports[0]));
                console.log("Первый отчет полностью:", reports[0]);
            }

            productionTable.innerHTML = "";

            if (!reports || reports.length === 0) {
                productionTable.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; color: #666;">
                            Нет данных для отображения
                        </td>
                    </tr>
                `;
                return;
            }

            reports.forEach(report => {
                const row = document.createElement("tr");
                row.dataset.id = report.id;

                // Используем правильные названия полей из API
                // Попробуем разные варианты названий полей
                const departmentName = report.DepartmentName || report.departmentName || report.department_name || '—';
                const warehouseName = report.WarehouseName || report.warehouseName || report.warehouse_name || '—';
                const responsibleName = report.ResponsibleName || report.responsibleName || report.responsible_name || report.responsible || '—';

                row.innerHTML = `
                    <td>${escapeHtml(report.doc_number || '—')}</td>
                    <td>${formatDate(report.date)}</td>
                    <td>${escapeHtml(departmentName)}</td>
                    <td>${escapeHtml(warehouseName)}</td>
                    <td>${escapeHtml(report.comment || '—')}</td>
                    <td>${escapeHtml(responsibleName)}</td>
                `;

                productionTable.appendChild(row);

                // Обработчик клика на строку
                row.addEventListener('click', function () {
                    selectReport(this);
                });
            });

            /*updateButtonsState();*/

        } catch (err) {
            console.error("Ошибка при загрузке отчетов производства:", err);
            productionTable.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: red;">
                        Ошибка загрузки данных: ${err.message}
                    </td>
                </tr>
            `;
        }
    }

    // ------------------------- Вспомогательные функции -------------------------
    function escapeHtml(text) {
        if (text === null || text === undefined || text === '—') return '—';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDate(dateString) {
        if (!dateString) return '—';
        try {
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('ru-RU');
        } catch (e) {
            console.error('Ошибка форматирования даты:', dateString, e);
            return '—';
        }
    }

    function selectReport(rowElement) {
        // Снимаем выделение со всех строк
        productionTable.querySelectorAll("tr").forEach(tr => {
            tr.classList.remove("selected");
        });

        // Выделяем текущую строку
        rowElement.classList.add("selected");

        // Сохраняем ID выбранного отчета
        selectedReportId = rowElement.dataset.id;
        console.log('Выбран отчет ID:', selectedReportId);

        /*updateButtonsState();*/
    }

    //function updateButtonsState() {
    //    const hasSelection = !!selectedReportId;

    //    if (editReportBtn) {
    //        editReportBtn.disabled = !hasSelection;
    //        editReportBtn.style.opacity = hasSelection ? '1' : '0.5';
    //    }

    //    if (deleteReportBtn) {
    //        deleteReportBtn.disabled = !hasSelection;
    //        deleteReportBtn.style.opacity = hasSelection ? '1' : '0.5';
    //    }
    //}

    // ------------------------- Поиск по таблице -------------------------
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            const filter = searchInput.value.toLowerCase();
            const rows = productionTable.querySelectorAll("tr");
            let hasVisibleRows = false;

            rows.forEach(row => {
                if (row.cells.length === 0) return; // Пропускаем пустые строки

                const match = Array.from(row.cells).some(td =>
                    td.textContent.toLowerCase().includes(filter)
                );
                row.style.display = match ? "" : "none";
                if (match) hasVisibleRows = true;
            });

            // Если после фильтрации нет видимых строк
            if (!hasVisibleRows && rows.length > 0) {
                if (!productionTable.querySelector('.no-results')) {
                    const noResults = document.createElement('tr');
                    noResults.className = 'no-results';
                    noResults.innerHTML = `
                        <td colspan="6" style="text-align: center; color: #666;">
                            Ничего не найдено
                        </td>
                    `;
                    productionTable.appendChild(noResults);
                }
            } else {
                const noResults = productionTable.querySelector('.no-results');
                if (noResults) noResults.remove();
            }
        });
    }

    // ------------------------- Сортировка -------------------------
    function initializeSorting() {
        const headers = document.querySelectorAll("#productionTable thead th");
        if (!headers.length) {
            console.warn('Заголовки таблицы не найдены');
            return;
        }

        headers.forEach((th, index) => {
            // Добавляем индикатор сортировки
            if (!th.querySelector('.sort-arrow')) {
                const arrow = document.createElement("span");
                arrow.classList.add("sort-arrow");
                arrow.innerHTML = "&#9650;"; // ▲
                th.appendChild(arrow);
            }

            th.style.cursor = "pointer";
            th.addEventListener("click", () => {
                sortTable(index);
            });
        });
    }

    function sortTable(columnIndex) {
        const rows = Array.from(productionTable.querySelectorAll("tr"));
        const header = document.querySelectorAll("#productionTable th")[columnIndex];
        const isAscending = !header.classList.contains("asc");

        // Сбрасываем сортировку у всех заголовков
        document.querySelectorAll("#productionTable th").forEach(h => {
            h.classList.remove("asc", "desc");
        });

        // Устанавливаем направление сортировки
        header.classList.add(isAscending ? "asc" : "desc");

        rows.sort((a, b) => {
            if (a.classList.contains('no-results')) return 1;
            if (b.classList.contains('no-results')) return -1;

            const aText = a.cells[columnIndex]?.textContent?.trim() || '';
            const bText = b.cells[columnIndex]?.textContent?.trim() || '';

            // Для дат (второй столбец)
            if (columnIndex === 1) {
                const dateA = new Date(aText.split('.').reverse().join('-'));
                const dateB = new Date(bText.split('.').reverse().join('-'));
                return isAscending ? dateA - dateB : dateB - dateA;
            }

            // Для чисел
            const numA = parseFloat(aText.replace(/[^0-9.-]+/g, ""));
            const numB = parseFloat(bText.replace(/[^0-9.-]+/g, ""));
            if (!isNaN(numA) && !isNaN(numB)) {
                return isAscending ? numA - numB : numB - numA;
            }

            // Для текста
            return isAscending
                ? aText.localeCompare(bText, 'ru')
                : bText.localeCompare(aText, 'ru');
        });

        // Очищаем таблицу и добавляем отсортированные строки
        productionTable.innerHTML = '';
        rows.forEach(row => productionTable.appendChild(row));

        // Восстанавливаем выделение если было
        if (selectedReportId) {
            const selectedRow = productionTable.querySelector(`tr[data-id="${selectedReportId}"]`);
            if (selectedRow) {
                selectedRow.classList.add("selected");
            }
        }
    }

    // ------------------------- Обработчики кнопок -------------------------
    if (editReportBtn) {
        editReportBtn.addEventListener('click', (e) => {
            e.preventDefault();

            if (!selectedReportId) {
                alert("Выберите отчет производства для редактирования!");
                return;
            }

            console.log('Редактирование отчета ID:', selectedReportId);
            window.location.href = `edit_production.html?id=${encodeURIComponent(selectedReportId)}`;
        });
    }

    if (deleteReportBtn) {
        deleteReportBtn.addEventListener("click", async () => {
            if (!selectedReportId) {
                alert("Выберите отчет для удаления!");
                return;
            }

            if (!confirm('Вы уверены, что хотите удалить этот отчет производства? Это действие нельзя отменить.')) {
                return;
            }

            try {
                console.log('Удаление отчета ID:', selectedReportId);
                const response = await fetch(`/api/productionreports/${selectedReportId}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Ошибка сервера: ${response.status}. ${errorText}`);
                }

                alert('Отчет производства успешно удален!');
                await loadProductionReports(); // Перезагружаем данные
                selectedReportId = null;
                /*updateButtonsState();*/

            } catch (error) {
                console.error('Ошибка удаления:', error);
                alert('Ошибка при удалении: ' + error.message);
            }
        });
    }

    // Двойной клик для редактирования
    if (productionTable) {
        productionTable.addEventListener('dblclick', (e) => {
            const row = e.target.closest('tr');
            if (row && row.dataset.id && !row.classList.contains('no-results')) {
                const rowId = row.dataset.id;
                console.log('Двойной клик, переход к редактированию ID:', rowId);
                window.location.href = `edit_production.html?id=${encodeURIComponent(rowId)}`;
            }
        });
    }

    // Инициализация
    loadProductionReports().then(() => {
        initializeSorting();
    });
});
