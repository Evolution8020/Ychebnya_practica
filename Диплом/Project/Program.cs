using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;


var builder = WebApplication.CreateBuilder(args);

//--------------------------------------------   DbContext   --------------------------------------------------------------

builder.Services.AddDbContext<DairyProductionContext>(options => options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

var app = builder.Build();

// ==============================================================   Запросы   ================================================================


// ================  Подразделение  ================================
app.MapGet("/api/departments", async (DairyProductionContext db) =>
    await db.departments.ToListAsync());

app.MapGet("/api/departments/{id}", async (DairyProductionContext db, int id) =>
{
    var dept = await db.departments.FindAsync(id);
    return dept == null ? Results.NotFound() : Results.Ok(dept);
});

app.MapPost("/api/departments", async (DairyProductionContext db, Department dept) =>
{
    db.departments.Add(dept);
    await db.SaveChangesAsync();
    return Results.Created($"/api/departments/{dept.id}", dept);
});

app.MapPut("/api/departments/{id}", async (DairyProductionContext db, int id, Department update) =>
{
    var dept = await db.departments.FindAsync(id);
    if (dept == null) return Results.NotFound();

    dept.name = update.name;
    dept.parent_id = update.parent_id;

    await db.SaveChangesAsync();
    return Results.Ok(dept);
});

app.MapDelete("/api/departments/{id}", async (DairyProductionContext db, int id) =>
{
    var dept = await db.departments.FindAsync(id);
    if (dept == null) return Results.NotFound();

    db.departments.Remove(dept);
    await db.SaveChangesAsync();
    return Results.Ok();
});


// ============================  Сотрудники  ===================================
app.MapGet("/api/employees", async (DairyProductionContext db) =>
    await db.employees.ToListAsync());

app.MapPost("/api/employees", async (DairyProductionContext db, Employee employee) =>
{
    db.employees.Add(employee);
    await db.SaveChangesAsync();
    return Results.Created($"/api/employees/{employee.id}", employee);
});

app.MapPut("/api/employees/{id}", async (DairyProductionContext db, int id, Employee update) =>
{
    var employee = await db.employees.FindAsync(id);
    if (employee == null) return Results.NotFound();

    employee.name = update.name;
    employee.department_id = update.department_id;
    employee.role = update.role;

    await db.SaveChangesAsync();
    return Results.Ok(employee);
});

app.MapPatch("/api/employees/{id}", async (DairyProductionContext db, int id, Employee update) =>
{
    var employee = await db.employees.FindAsync(id);
    if (employee == null) return Results.NotFound();

    if (update.name != null) employee.name = update.name;
    if (update.department_id > 0) employee.department_id = update.department_id;
    if (update.role != null) employee.role = update.role;

    await db.SaveChangesAsync();
    return Results.Ok(employee);
});

app.MapDelete("/api/employees/{id}", async (DairyProductionContext db, int id) =>
{
    var employee = await db.employees.FindAsync(id);
    if (employee == null) return Results.NotFound();

    db.employees.Remove(employee);
    await db.SaveChangesAsync();
    return Results.Ok();
});




app.MapGet("/api/warehousemovements", async (DairyProductionContext db,
    int? warehouseId, int? nomenclatureId, DateTime? dateFrom, DateTime? dateTo) =>
{
    var query = db.warehouse_movements
        .Include(r => r.Warehouse)
        .Include(r => r.Nomenclature)
        .AsQueryable();

    if (warehouseId.HasValue)
        query = query.Where(r => r.warehouse_id == warehouseId.Value);

    if (nomenclatureId.HasValue)
        query = query.Where(r => r.nomenclature_id == nomenclatureId.Value);

    if (dateFrom.HasValue)
    {
        // Используем только дату без времени
        query = query.Where(r => r.date.Date >= dateFrom.Value.Date);
    }

    if (dateTo.HasValue)
    {
        query = query.Where(r => r.date.Date <= dateTo.Value.Date);
    }

    var reports = await query
        .OrderBy(r => r.date) // Добавляем сортировку
        .Select(r => new
        {
            r.id,
            WarehouseName = r.Warehouse.name,
            NomenclatureName = r.Nomenclature.name,
            r.initial_balance,
            r.incoming,
            r.outgoing,
            r.final_balance,
            r.comment,
            Date = r.date.ToString("yyyy-MM-dd")
        })
        .ToListAsync();

    return Results.Ok(reports);
});


app.MapGet("/api/productionreport", async (DairyProductionContext db) =>
{
    var reports = await db.productionreport
        .Include(r => r.Department)   // подтягиваем подразделение
        .Include(r => r.Warehouse)    // подтягиваем склад
        .Select(r => new
        {
            r.id,
            r.doc_number,
            r.date,
            DepartmentName = r.Department.name,     // вместо id
            WarehouseName = r.Warehouse.name,       // вместо id
            ResponsibleName = r.responsible,   // вместо id
            r.comment
        })
        .ToListAsync();

    return reports;
});



// ================= Отчет производства =====================

app.MapGet("/api/productionreports/{id}", async (DairyProductionContext db, int id) =>
{
    var report = await db.productionreport
        .Include(r => r.Department)
        .Include(r => r.Warehouse)
        .Include(r => r.Products)
            .ThenInclude(p => p.Nomenclature)
        .Include(r => r.Materials)
            .ThenInclude(m => m.Nomenclature)
        .FirstOrDefaultAsync(r => r.id == id);

    if (report == null) return Results.NotFound();

    var result = new
    {
        report.id,
        report.doc_number,
        report.date,
        report.department_id,
        report.warehouse_id,
        report.responsible,
        report.comment,
        products = report.Products.Select(p => new
        {
            p.id,
            p.nomenclature_id,
            nomenclatureName = p.Nomenclature.name,
            unit = p.Nomenclature.base_unit,
            p.quantity,
            p.batch_number,
            p.shelf_life
        }).ToList(),
        materials = report.Materials.Select(m => new
        {
            m.id,
            m.nomenclature_id,
            nomenclatureName = m.Nomenclature.name,
            unit = m.Nomenclature.base_unit,
            m.quantity
        }).ToList()
    };

    return Results.Ok(result);
});

app.MapPost("/api/productionreports", async (DairyProductionContext db, ProductionReportPostDto dto) =>
{
    using var transaction = await db.Database.BeginTransactionAsync();

    try
    {
        var report = new ProductionReport
        {
            doc_number = dto.doc_number,
            date = dto.date,
            department_id = dto.department_id,
            warehouse_id = dto.warehouse_id,
            responsible = dto.responsible,
            comment = dto.comment,
            Products = dto.products?.Select(p => new ProductionProduct
            {
                nomenclature_id = p.product_id, // <-- берём из product_id
                quantity = p.quantity,
                batch_number = p.batch_number,
                shelf_life = p.shelf_life
            }).ToList() ?? new List<ProductionProduct>(),
            Materials = dto.materials?.Select(m => new ProductionMaterial
            {
                nomenclature_id = m.material_id, // <-- берём из material_id
                quantity = m.quantity
            }).ToList() ?? new List<ProductionMaterial>()
        };

        db.productionreport.Add(report);
        await db.SaveChangesAsync();

        // ======================
        // Обновляем складские движения
        // ======================
        // Материалы — списание
        foreach (var material in report.Materials)
        {
            var lastMovement = await db.warehouse_movements
                .Where(wm => wm.warehouse_id == report.warehouse_id
                          && wm.nomenclature_id == material.nomenclature_id)
                .OrderByDescending(wm => wm.date)
                .FirstOrDefaultAsync();

            int initialBalance = lastMovement?.final_balance ?? 0;

            var movement = new Warehouse_movements
            {
                warehouse_id = report.warehouse_id,
                nomenclature_id = material.nomenclature_id,
                initial_balance = initialBalance,
                incoming = 0,
                outgoing = (int)material.quantity,
                final_balance = initialBalance - (int)material.quantity,
                comment = $"Производство №{report.doc_number}",
                date = report.date
            };

            db.warehouse_movements.Add(movement);
        }

        // Продукция — поступление
        foreach (var product in report.Products)
        {
            var lastMovement = await db.warehouse_movements
                .Where(wm => wm.warehouse_id == report.warehouse_id
                          && wm.nomenclature_id == product.nomenclature_id)
                .OrderByDescending(wm => wm.date)
                .FirstOrDefaultAsync();

            int initialBalance = lastMovement?.final_balance ?? 0;

            var movement = new Warehouse_movements
            {
                warehouse_id = report.warehouse_id,
                nomenclature_id = product.nomenclature_id,
                initial_balance = initialBalance,
                incoming = (int)product.quantity,
                outgoing = 0,
                final_balance = initialBalance + (int)product.quantity,
                comment = $"Производство №{report.doc_number}",
                date = report.date
            };

            db.warehouse_movements.Add(movement);
        }

        await db.SaveChangesAsync();
        await transaction.CommitAsync();

        return Results.Created($"/api/productionreports/{report.id}", new { report.id });
    }
    catch (Exception ex)
    {
        await transaction.RollbackAsync();
        return Results.Problem($"Ошибка при создании отчета: {ex.Message}");
    }
});

// Обновление отчета
app.MapPut("/api/productionreports/{id}", async (DairyProductionContext db, int id, ProductionReportDto dto) =>
{
    using var transaction = await db.Database.BeginTransactionAsync();

    try
    {
        var existingReport = await db.productionreport
            .Include(r => r.Products)
            .Include(r => r.Materials)
            .FirstOrDefaultAsync(r => r.id == id);

        if (existingReport == null)
            return Results.NotFound($"Отчет с ID {id} не найден");

        // Обновляем основные данные
        existingReport.doc_number = dto.doc_number;
        existingReport.date = dto.date;
        existingReport.department_id = dto.department_id;
        existingReport.warehouse_id = dto.warehouse_id;
        existingReport.responsible = dto.responsible;
        existingReport.comment = dto.comment;

        // Удаляем старые данные
        db.production_products.RemoveRange(existingReport.Products);
        db.production_materials.RemoveRange(existingReport.Materials);

        // Удаляем старые движения
        var oldMovements = await db.warehouse_movements
            .Where(wm => wm.comment.Contains($"Производство №{existingReport.doc_number}"))
            .ToListAsync();
        db.warehouse_movements.RemoveRange(oldMovements);

        await db.SaveChangesAsync();

        // Добавляем новые данные
        if (dto.products != null && dto.products.Any())
        {
            var newProducts = dto.products.Select(p => new ProductionProduct
            {
                production_report_id = id,
                nomenclature_id = p.nomenclature_id,
                quantity = p.quantity,
                batch_number = p.batch_number,
                shelf_life = p.shelf_life
            }).ToList();
            db.production_products.AddRange(newProducts);
        }

        if (dto.materials != null && dto.materials.Any())
        {
            var newMaterials = dto.materials.Select(m => new ProductionMaterial
            {
                production_report_id = id,
                nomenclature_id = m.nomenclature_id,
                quantity = m.quantity
            }).ToList();
            db.production_materials.AddRange(newMaterials);
        }

        await db.SaveChangesAsync();

        // Создаем новые движения (аналогично POST)
        // ... код из POST endpoint

        await transaction.CommitAsync();
        return Results.Ok(new { message = "Отчет успешно обновлен", id = existingReport.id });
    }
    catch (Exception ex)
    {
        await transaction.RollbackAsync();
        return Results.Problem($"Ошибка при обновлении отчета: {ex.Message}");
    }
});

// Удаление отчета
app.MapDelete("/api/productionreports/{id}", async (DairyProductionContext db, int id) =>
{
    using var transaction = await db.Database.BeginTransactionAsync();

    try
    {
        var report = await db.productionreport
            .Include(r => r.Products)
            .Include(r => r.Materials)
            .FirstOrDefaultAsync(r => r.id == id);

        if (report == null) return Results.NotFound($"Отчет с ID {id} не найден");

        // Удаляем связанные warehouse_movements
        var movementsToDelete = await db.warehouse_movements
            .Where(wm => wm.comment.Contains($"Производство №{report.doc_number}"))
            .ToListAsync();

        if (movementsToDelete.Any())
        {
            db.warehouse_movements.RemoveRange(movementsToDelete);
        }

        // Удаляем отчет (продукция и материалы удалятся каскадно)
        db.productionreport.Remove(report);
        await db.SaveChangesAsync();

        await transaction.CommitAsync();
        return Results.Ok(new { message = "Отчет успешно удален" });
    }
    catch (Exception ex)
    {
        await transaction.RollbackAsync();
        return Results.Problem($"Ошибка при удалении отчета: {ex.Message}");
    }
});


// ================= Номенклатура ========================

app.MapGet("/api/nomenclatures", async (DairyProductionContext db) =>
    await db.nomenclature.ToListAsync());

app.MapGet("/api/nomenclatures/{id}", async (DairyProductionContext context, int id) =>
{
    var nomenclature = await context.nomenclature.FindAsync(id);
    return nomenclature == null ? Results.NotFound() : Results.Ok(nomenclature);
});

app.MapPost("/api/nomenclatures", async (DairyProductionContext db, Nomenclature n) =>
{
    db.nomenclature.Add(n);
    await db.SaveChangesAsync();
    return Results.Created($"/api/nomenclatures/{n.id}", n);
});

app.MapPut("/api/nomenclatures/{id}", async (DairyProductionContext db, int id, Nomenclature update) =>
{
    var n = await db.nomenclature.FindAsync(id);
    if (n == null) return Results.NotFound();

    n.group_name = update.group_name;
    n.name = update.name;
    n.base_unit = update.base_unit;
    n.type = update.type;
    n.comment = update.comment;
    n.number = update.number;

    await db.SaveChangesAsync();
    return Results.Ok(n);
});

app.MapPatch("/api/nomenclatures/{id}", async (DairyProductionContext db, int id, Nomenclature update) =>
{
    var n = await db.nomenclature.FindAsync(id);
    if (n == null) return Results.NotFound();

    if (update.group_name != null) n.group_name = update.group_name;
    if (update.name != null) n.name = update.name;
    if (update.base_unit != null) n.base_unit = update.base_unit;
    if (update.type != null) n.type = update.type;
    if (update.comment != null) n.comment = update.comment;
    if (update.number != null) n.number = update.number;

    await db.SaveChangesAsync();
    return Results.Ok(n);
});

app.MapDelete("/api/nomenclatures/{id}", async (DairyProductionContext db, int id) =>
{
    var n = await db.nomenclature.FindAsync(id);
    if (n == null) return Results.NotFound();

    db.nomenclature.Remove(n);
    await db.SaveChangesAsync();
    return Results.Ok();
});


// =================== Склады ===========================

app.MapGet("/api/warehouses", async (DairyProductionContext db) =>
    await db.warehouses.ToListAsync());

app.MapPost("/api/warehouses", async (DairyProductionContext db, Warehouse w) =>
{
    db.warehouses.Add(w);
    await db.SaveChangesAsync();
    return Results.Created($"/api/warehouses/{w.id}", w);
});

app.MapPut("/api/warehouses/{id}", async (DairyProductionContext db, int id, Warehouse update) =>
{
    var w = await db.warehouses.FindAsync(id);
    if (w == null) return Results.NotFound();

    w.name = update.name;
    w.type = update.type;
    w.address = update.address;
    w.number = update.number;

    await db.SaveChangesAsync();
    return Results.Ok(w);
});

app.MapPatch("/api/warehouses/{id}", async (DairyProductionContext db, int id, Warehouse update) =>
{
    var w = await db.warehouses.FindAsync(id);
    if (w == null) return Results.NotFound();

    if (update.name != null) w.name = update.name;
    if (update.type != null) w.type = update.type;
    if (update.address != null) w.address = update.address;
    if (update.number != null) w.number = update.number;

    await db.SaveChangesAsync();
    return Results.Ok(w);
});

app.MapDelete("/api/warehouses/{id}", async (DairyProductionContext db, int id) =>
{
    var w = await db.warehouses.FindAsync(id);
    if (w == null) return Results.NotFound();

    db.warehouses.Remove(w);
    await db.SaveChangesAsync();
    return Results.Ok();
});







// =================== Контрагенты ===================

app.MapGet("/api/counterparties", async (DairyProductionContext db) =>
    await db.counterparties.ToListAsync());

app.MapGet("/api/counterparties/{id}", async (DairyProductionContext db, int id) =>
{
    var c = await db.counterparties.FindAsync(id);
    return c == null ? Results.NotFound() : Results.Ok(c);
});

app.MapPost("/api/counterparties", async (DairyProductionContext db, Counterparty c) =>
{
    db.counterparties.Add(c);
    await db.SaveChangesAsync();
    return Results.Created($"/api/counterparties/{c.id}", c);
});

app.MapPut("/api/counterparties/{id}", async (DairyProductionContext db, int id, Counterparty update) =>
{
    var c = await db.counterparties.FindAsync(id);
    if (c == null) return Results.NotFound();

    c.name = update.name;
    c.inn = update.inn;
    c.contact = update.contact;

    await db.SaveChangesAsync();
    return Results.Ok(c);
});

app.MapDelete("/api/counterparties/{id}", async (DairyProductionContext db, int id) =>
{
    var c = await db.counterparties.FindAsync(id);
    if (c == null) return Results.NotFound();

    db.counterparties.Remove(c);
    await db.SaveChangesAsync();
    return Results.Ok();
});





// =================== Поступления ===================

// Получить все поступления
app.MapGet("/api/receiptitems", async (DairyProductionContext db) =>
{
    var reports = await db.receipts
        .Include(r => r.Сounterparty)
        .Include(r => r.Warehouse)
        .Include(r => r.Items)
            .ThenInclude(i => i.Nomenclature)
        .Select(r => new
        {
            r.id,
            r.doc_number,
            r.doc_ref,
            r.date,
            CounterpartyName = r.Сounterparty.name,
            WarehouseName = r.Warehouse.name,
            r.responsible, // просто строка
            r.comment,
            Items = r.Items.Select(i => new
            {
                i.id,
                NomenclatureName = i.Nomenclature.name,
                i.quantity,
                i.price
            }).ToList()
        })
        .ToListAsync();

    return reports;
});

app.MapGet("/api/receipts/{receiptId}/items", async (DairyProductionContext db, int receiptId) =>
{
    var items = await db.receiptitems
        .Where(i => i.receipt_id == receiptId)
        .Include(i => i.Nomenclature)
        .Select(i => new
        {
            i.id,
            i.nomenclature_id,
            NomenclatureName = i.Nomenclature.name,
            i.quantity,
            i.price
        })
        .ToListAsync();

    return Results.Ok(items);
});

app.MapPost("/api/receipts/{receiptId}/items", async (DairyProductionContext db, int receiptId, ReceiptItem item) =>
{
    item.receipt_id = receiptId;
    db.receiptitems.Add(item);
    await db.SaveChangesAsync();
    return Results.Created($"/api/receiptitems/{item.id}", item);
});

app.MapPut("/api/receiptitems/{id}", async (DairyProductionContext db, int id, ReceiptItem update) =>
{
    var item = await db.receiptitems.FindAsync(id);
    if (item == null) return Results.NotFound();

    item.nomenclature_id = update.nomenclature_id;
    item.quantity = update.quantity;
    item.price = update.price;

    await db.SaveChangesAsync();
    return Results.Ok(item);
});

app.MapGet("/api/receipts", async (DairyProductionContext db) =>
{
    var receipts = await db.receipts
        .Include(r => r.Сounterparty)
        .Include(r => r.Warehouse)
        .Include(r => r.Items)
        .Select(r => new
        {
            id = r.id,
            doc_number = r.doc_number,
            date = r.date,
            counterpartyName = r.Сounterparty.name,
            warehouseName = r.Warehouse.name,
            responsible = r.responsible,
            totalSum = r.Items.Sum(i => i.quantity * i.price) // сумма всех позиций
        })
        .ToListAsync();

    return Results.Ok(receipts);
});

app.MapPost("/api/receipts", async (DairyProductionContext db, ReceiptDto dto) =>
{
    using var transaction = await db.Database.BeginTransactionAsync();
    
    try
    {
        // 1. Создаём сущность Receipt
        var receipt = new Receipt
        {
            doc_number = dto.doc_number,
            date = dto.date,
            counterparty_id = dto.counterparty_id,
            warehouse_id = dto.warehouse_id,
            responsible = dto.responsible,
            comment = dto.comment,
            Items = dto.items?.Select(i => new ReceiptItem
            {
                nomenclature_id = i.nomenclature_id,
                quantity = i.quantity,
                price = i.price
            }).ToList() ?? new List<ReceiptItem>(),
        };

        db.receipts.Add(receipt);
        await db.SaveChangesAsync(); // Сохраняем, чтобы получить receipt.id

        // 2. Обновляем warehouse_movements для каждой позиции
        foreach (var item in receipt.Items)
        {
            // Находим последнюю запись для этого товара на этом складе
            var lastMovement = await db.warehouse_movements
                .Where(wm => wm.warehouse_id == receipt.warehouse_id 
                          && wm.nomenclature_id == item.nomenclature_id)
                .OrderByDescending(wm => wm.date)
                .FirstOrDefaultAsync();

            int initialBalance = lastMovement?.final_balance ?? 0;

            var movement = new Warehouse_movements
            {
                warehouse_id = receipt.warehouse_id,
                nomenclature_id = item.nomenclature_id,
                initial_balance = initialBalance,
                incoming = (int)item.quantity, // или decimal, смотря какой тип в модели
                outgoing = 0,
                final_balance = initialBalance + (int)item.quantity,
                comment = $"Поступление №{receipt.doc_number}",
                date = receipt.date
            };

            db.warehouse_movements.Add(movement);
        }

        await db.SaveChangesAsync();
        await transaction.CommitAsync();

        return Results.Created($"/api/receipts/{receipt.id}", new { receipt.id });
    }
    catch (Exception ex)
    {
        await transaction.RollbackAsync();
        return Results.Problem($"Ошибка при создании поступления: {ex.Message}");
    }
});

app.MapGet("/api/receipts/{id}", async (DairyProductionContext db, int id) =>
{
    var receipt = await db.receipts
        .Include(r => r.Сounterparty) 
        .Include(r => r.Warehouse)
        .Include(r => r.Items)
        .FirstOrDefaultAsync(r => r.id == id);

    if (receipt == null) return Results.NotFound();

    // Логирование для отладки
    Console.WriteLine($"[Receipt {id}] Дата из БД: {receipt.date:yyyy-MM-dd HH:mm:ss} (Kind: {receipt.date.Kind})");

    var result = new
    {
        receipt.id,
        receipt.doc_number,
        receipt.date,
        receipt.counterparty_id,
        receipt.warehouse_id,
        receipt.responsible,
        receipt.comment,
        items = receipt.Items.Select(i => new
        {
            i.id,
            i.nomenclature_id,
            i.quantity,
            i.price
        }).ToList()
    };

    return Results.Ok(result);
});

app.MapPut("/api/receipts/{id}", async (DairyProductionContext db, int id, ReceiptDto dto) =>
{
    using var transaction = await db.Database.BeginTransactionAsync();

    try
    {
        // Находим существующее поступление
        var existingReceipt = await db.receipts
            .Include(r => r.Items)
            .FirstOrDefaultAsync(r => r.id == id);

        if (existingReceipt == null)
            return Results.NotFound($"Поступление с ID {id} не найдено");

        // Логирование для отладки
        Console.WriteLine($"[Receipt Update {id}] Дата из DTO: {dto.date:yyyy-MM-dd HH:mm:ss} (Kind: {dto.date.Kind})");
        Console.WriteLine($"[Receipt Update {id}] Старая дата из БД: {existingReceipt.date:yyyy-MM-dd HH:mm:ss} (Kind: {existingReceipt.date.Kind})");

        // Запоминаем старые значения для обновления warehouse_movements
        var oldWarehouseId = existingReceipt.warehouse_id;
        var oldDate = existingReceipt.date;

        // Обновляем основные данные поступления
        existingReceipt.doc_number = dto.doc_number;
        existingReceipt.date = dto.date;
        
        Console.WriteLine($"[Receipt Update {id}] Новая дата после присвоения: {existingReceipt.date:yyyy-MM-dd HH:mm:ss} (Kind: {existingReceipt.date.Kind})");
        existingReceipt.counterparty_id = dto.counterparty_id;
        existingReceipt.warehouse_id = dto.warehouse_id;
        existingReceipt.responsible = dto.responsible;
        existingReceipt.comment = dto.comment;

        // 1. Удаляем старые позиции
        db.receiptitems.RemoveRange(existingReceipt.Items);

        // 2. Удаляем старые записи warehouse_movements для этого поступления
        var oldMovements = await db.warehouse_movements
            .Where(wm => wm.comment.Contains($"Поступление №{existingReceipt.doc_number}"))
            .ToListAsync();
        db.warehouse_movements.RemoveRange(oldMovements);

        await db.SaveChangesAsync();

        // 3. Добавляем новые позиции
        if (dto.items != null && dto.items.Any())
        {
            var newItems = dto.items.Select(i => new ReceiptItem
            {
                receipt_id = id,
                nomenclature_id = i.nomenclature_id,
                quantity = i.quantity,
                price = i.price
            }).ToList();

            db.receiptitems.AddRange(newItems);
            existingReceipt.Items = newItems;
        }

        await db.SaveChangesAsync();

        // 4. Создаем новые записи warehouse_movements
        if (existingReceipt.Items.Any())
        {
            foreach (var item in existingReceipt.Items)
            {
                // Находим последнюю запись для этого товара на этом складе
                var lastMovement = await db.warehouse_movements
                    .Where(wm => wm.warehouse_id == existingReceipt.warehouse_id
                              && wm.nomenclature_id == item.nomenclature_id)
                    .OrderByDescending(wm => wm.date)
                    .FirstOrDefaultAsync();

                int initialBalance = lastMovement?.final_balance ?? 0;

                var movement = new Warehouse_movements
                {
                    warehouse_id = existingReceipt.warehouse_id,
                    nomenclature_id = item.nomenclature_id,
                    initial_balance = initialBalance,
                    incoming = (int)item.quantity,
                    outgoing = 0,
                    final_balance = initialBalance + (int)item.quantity,
                    comment = $"Поступление №{existingReceipt.doc_number}",
                    date = existingReceipt.date
                };

                db.warehouse_movements.Add(movement);
            }

            await db.SaveChangesAsync();
        }

        await transaction.CommitAsync();

        return Results.Ok(new { message = "Поступление успешно обновлено", id = existingReceipt.id });
    }
    catch (Exception ex)
    {
        await transaction.RollbackAsync();
        return Results.Problem($"Ошибка при обновлении поступления: {ex.Message}");
    }
});

app.MapDelete("/api/receiptitems/{id}", async (DairyProductionContext db, int id) =>
{
    using var transaction = await db.Database.BeginTransactionAsync();

    try
    {
        var item = await db.receiptitems
            .Include(i => i.Receipt)
            .FirstOrDefaultAsync(i => i.id == id);

        if (item == null) return Results.NotFound();

        // 1. Удаляем связанные warehouse_movements для этой позиции
        var movementsToDelete = await db.warehouse_movements
            .Where(wm => wm.warehouse_id == item.Receipt.warehouse_id
                      && wm.nomenclature_id == item.nomenclature_id
                      && wm.comment.Contains($"Поступление №{item.Receipt.doc_number}"))
            .ToListAsync();

        if (movementsToDelete.Any())
        {
            db.warehouse_movements.RemoveRange(movementsToDelete);
        }

        // 2. Удаляем саму позицию
        db.receiptitems.Remove(item);
        await db.SaveChangesAsync();

        // 3. Пересчитываем warehouse_movements для всех оставшихся позиций этого поступления
        var receipt = await db.receipts
            .Include(r => r.Items)
            .ThenInclude(i => i.Nomenclature)
            .FirstOrDefaultAsync(r => r.id == item.receipt_id);

        if (receipt != null && receipt.Items.Any())
        {
            // Удаляем все старые движения для этого поступления
            var allOldMovements = await db.warehouse_movements
                .Where(wm => wm.comment.Contains($"Поступление №{receipt.doc_number}"))
                .ToListAsync();

            if (allOldMovements.Any())
            {
                db.warehouse_movements.RemoveRange(allOldMovements);
                await db.SaveChangesAsync();
            }

            // Создаем новые движения для оставшихся позиций
            foreach (var remainingItem in receipt.Items)
            {
                var lastMovement = await db.warehouse_movements
                    .Where(wm => wm.warehouse_id == receipt.warehouse_id
                              && wm.nomenclature_id == remainingItem.nomenclature_id)
                    .OrderByDescending(wm => wm.date)
                    .FirstOrDefaultAsync();

                int initialBalance = lastMovement?.final_balance ?? 0;

                var movement = new Warehouse_movements
                {
                    warehouse_id = receipt.warehouse_id,
                    nomenclature_id = remainingItem.nomenclature_id,
                    initial_balance = initialBalance,
                    incoming = (int)remainingItem.quantity,
                    outgoing = 0,
                    final_balance = initialBalance + (int)remainingItem.quantity,
                    comment = $"Поступление №{receipt.doc_number}",
                    date = receipt.date
                };

                db.warehouse_movements.Add(movement);
            }

            await db.SaveChangesAsync();
        }

        await transaction.CommitAsync();
        return Results.Ok(new { message = "Позиция успешно удалена" });
    }
    catch (Exception ex)
    {
        await transaction.RollbackAsync();
        return Results.Problem($"Ошибка при удалении позиции: {ex.Message}");
    }
});

app.MapDelete("/api/receipts/{id}", async (DairyProductionContext db, int id) =>
{
    using var transaction = await db.Database.BeginTransactionAsync();

    try
    {
        // Находим поступление со всеми позициями
        var receipt = await db.receipts
            .Include(r => r.Items)
            .FirstOrDefaultAsync(r => r.id == id);

        if (receipt == null) return Results.NotFound($"Поступление с ID {id} не найдено");

        // 1. Удаляем связанные warehouse_movements
        var movementsToDelete = await db.warehouse_movements
            .Where(wm => wm.comment.Contains($"Поступление №{receipt.doc_number}"))
            .ToListAsync();

        if (movementsToDelete.Any())
        {
            db.warehouse_movements.RemoveRange(movementsToDelete);
        }

        // 2. Удаляем все позиции поступления (каскадно)
        // Если настроено каскадное удаление в БД, это может быть не нужно
        if (receipt.Items.Any())
        {
            db.receiptitems.RemoveRange(receipt.Items);
        }

        // 3. Удаляем само поступление
        db.receipts.Remove(receipt);
        await db.SaveChangesAsync();

        await transaction.CommitAsync();

        return Results.Ok(new { message = "Поступление успешно удалено" });
    }
    catch (Exception ex)
    {
        await transaction.RollbackAsync();
        return Results.Problem($"Ошибка при удалении поступления: {ex.Message}");
    }
});



// =================== Пользователи (Users) ===================
app.MapGet("/api/users", async (DairyProductionContext db) =>
    await db.users.ToListAsync());

app.MapGet("/api/users/{username}", async (DairyProductionContext db, string username) =>
{
    var user = await db.users.FindAsync(username);
    return user == null ? Results.NotFound() : Results.Ok(user);
});

app.MapPost("/api/users", async (DairyProductionContext db, User user) =>
{
    // Проверяем, нет ли пользователя с таким username
    var existingUser = await db.users.FindAsync(user.username);
    if (existingUser != null)
        return Results.BadRequest("Пользователь с таким логином уже существует");

    db.users.Add(user);
    await db.SaveChangesAsync();
    return Results.Created($"/api/users/{user.username}", user);
});

app.MapPut("/api/users/{username}", async (DairyProductionContext db, string username, User update) =>
{
    var user = await db.users.FindAsync(username);
    if (user == null) return Results.NotFound();

    // Если username изменяется, нужно проверить, не занят ли новый username
    if (update.username != username)
    {
        var existingUser = await db.users.FindAsync(update.username);
        if (existingUser != null)
            return Results.BadRequest("Пользователь с таким логином уже существует");
        
        // Удаляем старую запись и создаем новую с новым username
        db.users.Remove(user);
        user = new User
        {
            username = update.username,
            password = update.password,
            full_name = update.full_name,
            role = update.role
        };
        db.users.Add(user);
    }
    else
    {
        user.password = update.password;
        user.full_name = update.full_name;
        user.role = update.role;
    }

    await db.SaveChangesAsync();
    return Results.Ok(user);
});

app.MapDelete("/api/users/{username}", async (DairyProductionContext db, string username) =>
{
    var user = await db.users.FindAsync(username);
    if (user == null) return Results.NotFound();

    db.users.Remove(user);
    await db.SaveChangesAsync();
    return Results.Ok();
});


// =================== Аутентификация ===================
app.MapPost("/api/auth/login", async (DairyProductionContext db, LoginDto login) =>
{
    var user = await db.users
        .FirstOrDefaultAsync(u => u.username == login.Username && u.password == login.Password);

    if (user == null)
        return Results.Unauthorized();

    // Генерируем простой токен (в реальном приложении используй JWT)
    var token = Guid.NewGuid().ToString();

    return Results.Ok(new
    {
        token = token,
        user = new
        {
            username = user.username,
            full_name = user.full_name,
            role = user.role
        }
    });
});

app.MapPost("/api/auth/register", async (DairyProductionContext db, RegisterDto register) =>
{
    // Проверяем, нет ли пользователя с таким логином
    var existingUser = await db.users.FirstOrDefaultAsync(u => u.username == register.Username);
    if (existingUser != null)
        return Results.BadRequest("Пользователь с таким логином уже существует");

    var user = new User
    {
        username = register.Username,
        password = register.Password,
        full_name = register.FullName,
        role = "user" // По умолчанию обычный пользователь
    };

    db.users.Add(user);
    await db.SaveChangesAsync();

    return Results.Ok(new { message = "Пользователь успешно зарегистрирован", username = user.username });
});

// Получить текущего пользователя по токену (заглушка)
app.MapGet("/api/auth/me", async (HttpContext context, DairyProductionContext db) =>
{
    // В реальном приложении здесь должна быть проверка JWT токена
    var token = context.Request.Headers["Authorization"].FirstOrDefault()?.Replace("Bearer ", "");

    if (string.IsNullOrEmpty(token))
        return Results.Unauthorized();

    // Заглушка - возвращаем первого пользователя
    var user = await db.users.FirstOrDefaultAsync();
    if (user == null)
        return Results.NotFound();

    return Results.Ok(new
    {
        username = user.username,
        full_name = user.full_name,
        role = user.role
    });
});



// =================== СПИСАНИЯ ===================

// Получить все списания
app.MapGet("/api/writeoffs", async (DairyProductionContext db) =>
{
    var writeoffs = await db.writeoffs
        .Include(w => w.Warehouse)
        .Include(w => w.Items)
        .ThenInclude(i => i.Nomenclature)
        .Select(w => new
        {
            id = w.id,
            doc_number = w.doc_number,
            date = w.date,
            operation_type = w.operation_type,
            warehouseName = w.Warehouse.name,
            responsible = w.responsible,
            reason = w.reason,
            comment = w.comment,
            totalQuantity = w.Items.Sum(i => i.quantity)
        })
        .ToListAsync();

    return Results.Ok(writeoffs);
});

// Получить списание по ID
app.MapGet("/api/writeoffs/{id}", async (DairyProductionContext db, int id) =>
{
    var writeoff = await db.writeoffs
        .Include(w => w.Warehouse)
        .Include(w => w.Items)
        .ThenInclude(i => i.Nomenclature)
        .FirstOrDefaultAsync(w => w.id == id);

    if (writeoff == null) return Results.NotFound();

    // Логирование для отладки
    Console.WriteLine($"[WriteOff {id}] Дата из БД: {writeoff.date:yyyy-MM-dd HH:mm:ss} (Kind: {writeoff.date.Kind})");

    var result = new
    {
        writeoff.id,
        writeoff.doc_number,
        writeoff.date,
        writeoff.warehouse_id,
        writeoff.operation_type,
        writeoff.responsible,
        writeoff.reason,
        writeoff.comment,
        writeoff.basis,
        items = writeoff.Items.Select(i => new
        {
            i.id,
            i.nomenclature_id,
            nomenclatureName = i.Nomenclature.name,
            unit = i.Nomenclature.base_unit,
            i.quantity
        }).ToList()
    };

    return Results.Ok(result);
});

// Создать списание
app.MapPost("/api/writeoffs", async (DairyProductionContext db, WriteOffDto dto) =>
{
    using var transaction = await db.Database.BeginTransactionAsync();

    try
    {
        // Создаём списание
        var writeoff = new WriteOff
        {
            doc_number = dto.doc_number,
            date = dto.date,
            warehouse_id = dto.warehouse_id,
            operation_type = "Списание",
            responsible = dto.responsible,
            reason = dto.reason,
            comment = dto.comment,
            basis = dto.basis,
            Items = dto.items?.Select(i => new WriteOffItem
            {
                nomenclature_id = i.nomenclature_id,
                quantity = i.quantity
            }).ToList() ?? new List<WriteOffItem>(),
        };

        db.writeoffs.Add(writeoff);
        await db.SaveChangesAsync();

        // Обновляем warehouse_movements (уменьшаем остатки)
        foreach (var item in writeoff.Items)
        {
            // Находим последнюю запись для этого товара на этом складе
            var lastMovement = await db.warehouse_movements
                .Where(wm => wm.warehouse_id == writeoff.warehouse_id
                          && wm.nomenclature_id == item.nomenclature_id)
                .OrderByDescending(wm => wm.date)
                .FirstOrDefaultAsync();

            int initialBalance = lastMovement?.final_balance ?? 0;

            var movement = new Warehouse_movements
            {
                warehouse_id = writeoff.warehouse_id,
                nomenclature_id = item.nomenclature_id,
                initial_balance = initialBalance,
                incoming = 0,
                outgoing = (int)item.quantity, // списываем
                final_balance = initialBalance - (int)item.quantity,
                comment = $"Списание №{writeoff.doc_number}",
                date = writeoff.date
            };

            db.warehouse_movements.Add(movement);
        }

        await db.SaveChangesAsync();
        await transaction.CommitAsync();

        return Results.Created($"/api/writeoffs/{writeoff.id}", new { writeoff.id });
    }
    catch (Exception ex)
    {
        await transaction.RollbackAsync();
        return Results.Problem($"Ошибка при создании списания: {ex.Message}");
    }
});

// Обновить списание
app.MapPut("/api/writeoffs/{id}", async (DairyProductionContext db, int id, WriteOffDto dto) =>
{
    using var transaction = await db.Database.BeginTransactionAsync();

    try
    {
        var existingWriteOff = await db.writeoffs
            .Include(w => w.Items)
            .FirstOrDefaultAsync(w => w.id == id);

        if (existingWriteOff == null)
            return Results.NotFound($"Списание с ID {id} не найдено");

        // Логирование для отладки
        Console.WriteLine($"[WriteOff Update {id}] Дата из DTO: {dto.date:yyyy-MM-dd HH:mm:ss} (Kind: {dto.date.Kind})");
        Console.WriteLine($"[WriteOff Update {id}] Старая дата из БД: {existingWriteOff.date:yyyy-MM-dd HH:mm:ss} (Kind: {existingWriteOff.date.Kind})");

        // Запоминаем старые значения
        var oldWarehouseId = existingWriteOff.warehouse_id;
        var oldDate = existingWriteOff.date;

        // Обновляем основные данные
        existingWriteOff.doc_number = dto.doc_number;
        existingWriteOff.date = dto.date;
        
        Console.WriteLine($"[WriteOff Update {id}] Новая дата после присвоения: {existingWriteOff.date:yyyy-MM-dd HH:mm:ss} (Kind: {existingWriteOff.date.Kind})");
        existingWriteOff.warehouse_id = dto.warehouse_id;
        existingWriteOff.responsible = dto.responsible;
        existingWriteOff.reason = dto.reason;
        existingWriteOff.comment = dto.comment;
        existingWriteOff.basis = dto.basis;

        // Удаляем старые позиции и движения
        db.writeoffitems.RemoveRange(existingWriteOff.Items);

        var oldMovements = await db.warehouse_movements
            .Where(wm => wm.comment.Contains($"Списание №{existingWriteOff.doc_number}"))
            .ToListAsync();
        db.warehouse_movements.RemoveRange(oldMovements);

        await db.SaveChangesAsync();

        // Добавляем новые позиции
        if (dto.items != null && dto.items.Any())
        {
            var newItems = dto.items.Select(i => new WriteOffItem
            {
                writeoff_id = id,
                nomenclature_id = i.nomenclature_id,
                quantity = i.quantity
            }).ToList();

            db.writeoffitems.AddRange(newItems);
            existingWriteOff.Items = newItems;
        }

        await db.SaveChangesAsync();

        // Создаем новые движения
        if (existingWriteOff.Items.Any())
        {
            foreach (var item in existingWriteOff.Items)
            {
                var lastMovement = await db.warehouse_movements
                    .Where(wm => wm.warehouse_id == existingWriteOff.warehouse_id
                              && wm.nomenclature_id == item.nomenclature_id)
                    .OrderByDescending(wm => wm.date)
                    .FirstOrDefaultAsync();

                int initialBalance = lastMovement?.final_balance ?? 0;

                var movement = new Warehouse_movements
                {
                    warehouse_id = existingWriteOff.warehouse_id,
                    nomenclature_id = item.nomenclature_id,
                    initial_balance = initialBalance,
                    incoming = 0,
                    outgoing = (int)item.quantity,
                    final_balance = initialBalance - (int)item.quantity,
                    comment = $"Списание №{existingWriteOff.doc_number}",
                    date = existingWriteOff.date
                };

                db.warehouse_movements.Add(movement);
            }

            await db.SaveChangesAsync();
        }

        await transaction.CommitAsync();
        return Results.Ok(new { message = "Списание успешно обновлено", id = existingWriteOff.id });
    }
    catch (Exception ex)
    {
        await transaction.RollbackAsync();
        return Results.Problem($"Ошибка при обновлении списания: {ex.Message}");
    }
});

// Удалить списание
app.MapDelete("/api/writeoffs/{id}", async (DairyProductionContext db, int id) =>
{
    using var transaction = await db.Database.BeginTransactionAsync();

    try
    {
        var writeoff = await db.writeoffs
            .Include(w => w.Items)
            .FirstOrDefaultAsync(w => w.id == id);

        if (writeoff == null) return Results.NotFound($"Списание с ID {id} не найдено");

        // Удаляем связанные warehouse_movements
        var movementsToDelete = await db.warehouse_movements
            .Where(wm => wm.comment.Contains($"Списание №{writeoff.doc_number}"))
            .ToListAsync();

        if (movementsToDelete.Any())
        {
            db.warehouse_movements.RemoveRange(movementsToDelete);
        }

        // Удаляем списание (позиции удалятся каскадно)
        db.writeoffs.Remove(writeoff);
        await db.SaveChangesAsync();

        await transaction.CommitAsync();
        return Results.Ok(new { message = "Списание успешно удалено" });
    }
    catch (Exception ex)
    {
        await transaction.RollbackAsync();
        return Results.Problem($"Ошибка при удалении списания: {ex.Message}");
    }
});
















// =================== ПЕРЕМЕЩЕНИЯ ТОВАРОВ ===================

// Получить все перемещения
app.MapGet("/api/transfers", async (DairyProductionContext db) =>
{
    var transfers = await db.transfers
        .Include(t => t.WarehouseFrom)
        .Include(t => t.WarehouseTo)
        .Include(t => t.Items)
        .ThenInclude(i => i.Nomenclature)
        .Select(t => new
        {
            id = t.id,
            doc_number = t.doc_number,
            date = t.date,
            warehouseFromName = t.WarehouseFrom.name,
            warehouseToName = t.WarehouseTo.name,
            responsible = t.responsible,
            comment = t.comment,
            totalQuantity = t.Items.Sum(i => i.quantity)
        })
        .ToListAsync();

    return Results.Ok(transfers);
});

// Получить перемещение по ID
app.MapGet("/api/transfers/{id}", async (DairyProductionContext db, int id) =>
{
    var transfer = await db.transfers
        .Include(t => t.WarehouseFrom)
        .Include(t => t.WarehouseTo)
        .Include(t => t.Items)
        .ThenInclude(i => i.Nomenclature)
        .FirstOrDefaultAsync(t => t.id == id);

    if (transfer == null) return Results.NotFound();

    var result = new
    {
        transfer.id,
        transfer.doc_number,
        transfer.date,
        transfer.warehouse_from_id,
        transfer.warehouse_to_id,
        transfer.responsible,
        transfer.comment,
        items = transfer.Items.Select(i => new
        {
            i.id,
            i.nomenclature_id,
            nomenclatureName = i.Nomenclature.name,
            unit = i.Nomenclature.base_unit,
            i.quantity
        }).ToList()
    };

    return Results.Ok(result);
});

// Создать перемещение
app.MapPost("/api/transfers", async (DairyProductionContext db, TransferDto dto) =>
{
    using var transaction = await db.Database.BeginTransactionAsync();

    try
    {
        // Проверяем что склады разные
        if (dto.warehouse_from_id == dto.warehouse_to_id)
        {
            return Results.BadRequest("Склад отправления и склад назначения должны быть разными");
        }

        // Создаём перемещение
        var transfer = new Transfer
        {
            doc_number = dto.doc_number,
            date = dto.date,
            warehouse_from_id = dto.warehouse_from_id,
            warehouse_to_id = dto.warehouse_to_id,
            responsible = dto.responsible,
            comment = dto.comment,
            Items = dto.items?.Select(i => new TransferItem
            {
                nomenclature_id = i.nomenclature_id,
                quantity = i.quantity
            }).ToList() ?? new List<TransferItem>(),
        };

        db.transfers.Add(transfer);
        await db.SaveChangesAsync();

        // Обновляем warehouse_movements
        foreach (var item in transfer.Items)
        {
            // 1. Списание со склада-отправителя
            var lastMovementFrom = await db.warehouse_movements
                .Where(wm => wm.warehouse_id == transfer.warehouse_from_id
                          && wm.nomenclature_id == item.nomenclature_id)
                .OrderByDescending(wm => wm.date)
                .FirstOrDefaultAsync();

            int initialBalanceFrom = lastMovementFrom?.final_balance ?? 0;

            var movementFrom = new Warehouse_movements
            {
                warehouse_id = transfer.warehouse_from_id,
                nomenclature_id = item.nomenclature_id,
                initial_balance = initialBalanceFrom,
                incoming = 0,
                outgoing = (int)item.quantity,
                final_balance = initialBalanceFrom - (int)item.quantity,
                comment = $"Перемещение №{transfer.doc_number} (отправка)",
                date = transfer.date
            };

            db.warehouse_movements.Add(movementFrom);

            // 2. Поступление на склад-получатель
            var lastMovementTo = await db.warehouse_movements
                .Where(wm => wm.warehouse_id == transfer.warehouse_to_id
                          && wm.nomenclature_id == item.nomenclature_id)
                .OrderByDescending(wm => wm.date)
                .FirstOrDefaultAsync();

            int initialBalanceTo = lastMovementTo?.final_balance ?? 0;

            var movementTo = new Warehouse_movements
            {
                warehouse_id = transfer.warehouse_to_id,
                nomenclature_id = item.nomenclature_id,
                initial_balance = initialBalanceTo,
                incoming = (int)item.quantity,
                outgoing = 0,
                final_balance = initialBalanceTo + (int)item.quantity,
                comment = $"Перемещение №{transfer.doc_number} (приём)",
                date = transfer.date
            };

            db.warehouse_movements.Add(movementTo);
        }

        await db.SaveChangesAsync();
        await transaction.CommitAsync();

        return Results.Created($"/api/transfers/{transfer.id}", new { transfer.id });
    }
    catch (Exception ex)
    {
        await transaction.RollbackAsync();
        return Results.Problem($"Ошибка при создании перемещения: {ex.Message}");
    }
});

// Обновить перемещение
app.MapPut("/api/transfers/{id}", async (DairyProductionContext db, int id, TransferDto dto) =>
{
    using var transaction = await db.Database.BeginTransactionAsync();

    try
    {
        // Находим существующее перемещение
        var existingTransfer = await db.transfers
            .Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.id == id);

        if (existingTransfer == null)
            return Results.NotFound($"Перемещение с ID {id} не найдено");

        // Проверяем что склады разные
        if (dto.warehouse_from_id == dto.warehouse_to_id)
        {
            return Results.BadRequest("Склад отправления и склад назначения должны быть разными");
        }

        // Запоминаем старый номер документа для поиска движений
        var oldDocNumber = existingTransfer.doc_number;

        // Обновляем основные данные
        existingTransfer.doc_number = dto.doc_number;
        existingTransfer.date = dto.date;
        existingTransfer.warehouse_from_id = dto.warehouse_from_id;
        existingTransfer.warehouse_to_id = dto.warehouse_to_id;
        existingTransfer.responsible = dto.responsible;
        existingTransfer.comment = dto.comment;

        // Удаляем старые позиции
        db.transferitems.RemoveRange(existingTransfer.Items);

        // Удаляем старые записи warehouse_movements
        var oldMovements = await db.warehouse_movements
            .Where(wm => wm.comment.Contains($"Перемещение №{oldDocNumber}"))
            .ToListAsync();
        db.warehouse_movements.RemoveRange(oldMovements);

        await db.SaveChangesAsync();

        // Добавляем новые позиции
        if (dto.items != null && dto.items.Any())
        {
            var newItems = dto.items.Select(i => new TransferItem
            {
                transfer_id = id,
                nomenclature_id = i.nomenclature_id,
                quantity = i.quantity
            }).ToList();

            db.transferitems.AddRange(newItems);
            existingTransfer.Items = newItems;
        }

        await db.SaveChangesAsync();

        // Создаем новые записи warehouse_movements
        foreach (var item in existingTransfer.Items)
        {
            // 1. Списание со склада-отправителя
            var lastMovementFrom = await db.warehouse_movements
                .Where(wm => wm.warehouse_id == existingTransfer.warehouse_from_id
                          && wm.nomenclature_id == item.nomenclature_id)
                .OrderByDescending(wm => wm.date)
                .FirstOrDefaultAsync();

            int initialBalanceFrom = lastMovementFrom?.final_balance ?? 0;

            var movementFrom = new Warehouse_movements
            {
                warehouse_id = existingTransfer.warehouse_from_id,
                nomenclature_id = item.nomenclature_id,
                initial_balance = initialBalanceFrom,
                incoming = 0,
                outgoing = (int)item.quantity,
                final_balance = initialBalanceFrom - (int)item.quantity,
                comment = $"Перемещение №{existingTransfer.doc_number} (отправка)",
                date = existingTransfer.date
            };

            db.warehouse_movements.Add(movementFrom);

            // 2. Поступление на склад-получатель
            var lastMovementTo = await db.warehouse_movements
                .Where(wm => wm.warehouse_id == existingTransfer.warehouse_to_id
                          && wm.nomenclature_id == item.nomenclature_id)
                .OrderByDescending(wm => wm.date)
                .FirstOrDefaultAsync();

            int initialBalanceTo = lastMovementTo?.final_balance ?? 0;

            var movementTo = new Warehouse_movements
            {
                warehouse_id = existingTransfer.warehouse_to_id,
                nomenclature_id = item.nomenclature_id,
                initial_balance = initialBalanceTo,
                incoming = (int)item.quantity,
                outgoing = 0,
                final_balance = initialBalanceTo + (int)item.quantity,
                comment = $"Перемещение №{existingTransfer.doc_number} (приём)",
                date = existingTransfer.date
            };

            db.warehouse_movements.Add(movementTo);
        }

        await db.SaveChangesAsync();
        await transaction.CommitAsync();

        return Results.Ok(new { message = "Перемещение успешно обновлено" });
    }
    catch (Exception ex)
    {
        await transaction.RollbackAsync();
        return Results.Problem($"Ошибка при обновлении перемещения: {ex.Message}");
    }
});

// Удалить перемещение
app.MapDelete("/api/transfers/{id}", async (DairyProductionContext db, int id) =>
{
    using var transaction = await db.Database.BeginTransactionAsync();

    try
    {
        var transfer = await db.transfers
            .Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.id == id);

        if (transfer == null) return Results.NotFound($"Перемещение с ID {id} не найдено");

        // Удаляем связанные warehouse_movements
        var movementsToDelete = await db.warehouse_movements
            .Where(wm => wm.comment.Contains($"Перемещение №{transfer.doc_number}"))
            .ToListAsync();

        if (movementsToDelete.Any())
        {
            db.warehouse_movements.RemoveRange(movementsToDelete);
        }

        // Удаляем перемещение (позиции удалятся каскадно)
        db.transfers.Remove(transfer);
        await db.SaveChangesAsync();

        await transaction.CommitAsync();
        return Results.Ok(new { message = "Перемещение успешно удалено" });
    }
    catch (Exception ex)
    {
        await transaction.RollbackAsync();
        return Results.Problem($"Ошибка при удалении перемещения: {ex.Message}");
    }
});


// ------------------------------------------ КОНЕЦ ЗАПРОСОВ -------------------------------------------------------------------------


// =================== Статика ===================
app.UseDefaultFiles(new DefaultFilesOptions { DefaultFileNames = { "login.html" } });
app.UseStaticFiles();

app.Run();


// ----------------------------------------------- PUBLIC CLASS ----------------------------------------
public class ProductionReport
{
    [Key]
    public int id { get; set; }
    public string? doc_number { get; set; }
    public DateTime date { get; set; }
    public int department_id { get; set; } // FK на Departments
    public Department Department { get; set; }
    public int warehouse_id { get; set; } // FK на Warehouses
    public Warehouse Warehouse { get; set; }
    public string responsible { get; set; }
    public string comment { get; set; }
    public List<ProductionProduct> Products { get; set; } = new();
    public List<ProductionMaterial> Materials { get; set; } = new();
}

// Выпущенная продукция
public class ProductionProduct
{
    [Key]
    public int id { get; set; }
    public int production_report_id { get; set; }
    public ProductionReport ProductionReport { get; set; }
    public int nomenclature_id { get; set; }
    public Nomenclature Nomenclature { get; set; }
    public decimal quantity { get; set; }
    public int batch_number { get; set; } // номер партии
    public int shelf_life { get; set; } // срок годности в днях
}

// Использованные материалы
public class ProductionMaterial
{
    [Key]
    public int id { get; set; }
    public int production_report_id { get; set; }
    public ProductionReport ProductionReport { get; set; }
    public int nomenclature_id { get; set; }
    public Nomenclature Nomenclature { get; set; }
    public decimal quantity { get; set; }
}

// DTO для создания отчета
public class ProductionReportDto
{
    public string doc_number { get; set; }
    public DateTime date { get; set; }
    public int department_id { get; set; }
    public int warehouse_id { get; set; }
    public string responsible { get; set; } // изменил на string чтобы соответствовать форме
    public string comment { get; set; }
    public List<ProductionProductDto> products { get; set; }
    public List<ProductionMaterialDto> materials { get; set; }
}

public class ProductionProductDto
{
    public int nomenclature_id { get; set; }
    public decimal quantity { get; set; }
    public int batch_number { get; set; }
    public int shelf_life { get; set; }
}

public class ProductionMaterialDto
{
    public int nomenclature_id { get; set; }
    public decimal quantity { get; set; }
}





// ===== DTO для работы с твоим JSON =====
public class ProductionReportPostDto
{
    public string doc_number { get; set; }
    public DateTime date { get; set; }
    public int department_id { get; set; }
    public int warehouse_id { get; set; }
    public string responsible { get; set; }
    public string comment { get; set; }
    public List<ProductionProductPostDto> products { get; set; }
    public List<ProductionMaterialPostDto> materials { get; set; }
}

public class ProductionProductPostDto
{
    public int product_id { get; set; } // <-- соответствует JSON
    public decimal quantity { get; set; }
    public int batch_number { get; set; }
    public int shelf_life { get; set; }
}

public class ProductionMaterialPostDto
{
    public int material_id { get; set; } // <-- соответствует JSON
    public decimal quantity { get; set; }
}











// Таблица ведомость товаров на складах 
public class Warehouse_movements
{
    [Key]
    public int id { get; set; }
    public int warehouse_id { get; set; }
    public Warehouse Warehouse { get; set; }
    public int nomenclature_id { get; set; }
    public Nomenclature Nomenclature { get; set; }
    public int initial_balance { get; set; }
    public int incoming { get; set; }
    public int outgoing { get; set; }
    public int final_balance { get; set; }
    public string comment { get; set; }
    public DateTime date { get; set; }

}




// Подразделение
public class Department
{
    [Key]
    public int id { get; set; }
    public string name { get; set; }
    public int? parent_id { get; set; }
}

// Номенклатура
public class Nomenclature
{
    [Key]
    public int id { get; set; }
    public string? group_name { get; set; }
    public string name { get; set; }
    public string base_unit { get; set; }
    public string type { get; set; }
    public string? comment { get; set; }
    public int? number { get; set; }
}

// Склад
public class Warehouse
{
    [Key]
    public int id { get; set; }
    public string name { get; set; }
    public string? type {  get; set; }
    public string address { get; set; }
    public int? number { get; set; }


}


// Сотрудники
public class Employee
{
    [Key]
    public int id { get; set; }
    public string name { get; set; }
    public int department_id { get; set; }
    public string role { get; set; }

}

// Контрагенты
public class Counterparty
{
    [Key]
    public int id { get; set; }
    public string name { get; set; }
    public string inn { get; set; }
    public string contact { get; set; }
}


// Сущность Receipt (поступление)
public class Receipt
{
    [Key]
    public int id { get; set; }
    public string doc_number { get; set; }
    public string? doc_ref { get; set; }
    public DateTime date { get; set; }
    public int counterparty_id { get; set; }
    public Counterparty Сounterparty { get; set; }
    public int warehouse_id { get; set; }
    public Warehouse Warehouse { get; set; }

    public string responsible { get; set; } // просто имя
    public string comment { get; set; }

    public List<ReceiptItem> Items { get; set; } = new();
}


// Сущность ReceiptItem
public class ReceiptItem
{
    [Key]
    public int id { get; set; }
    public int receipt_id { get; set; }
    public Receipt Receipt { get; set; }

    public int nomenclature_id { get; set; }
    public Nomenclature Nomenclature { get; set; }

    public decimal quantity { get; set; }
    public decimal price { get; set; }
}


// Пользователи 

public class User
{
    [Key]
    public string username { get; set; }
    public string password { get; set; }
    public string full_name { get; set; }
    public string role { get; set; }
}

public class LoginDto
{
    public string Username { get; set; }
    public string Password { get; set; }
}

public class RegisterDto
{
    public string Username { get; set; }
    public string Password { get; set; }
    public string FullName { get; set; }
    public string Email { get; set; }
}





public class ReceiptDto
{
    public string doc_number { get; set; }
    public DateTime date { get; set; }
    public int counterparty_id { get; set; }
    public int warehouse_id { get; set; }
    public string responsible { get; set; }
    public string comment { get; set; }
    public List<ReceiptItemDto> items { get; set; }
}

public class ReceiptItemDto
{
    public int nomenclature_id { get; set; }
    public decimal quantity { get; set; }
    public decimal price { get; set; }
}


public class ProductionReportMaterial
{
    [Key]
    public int id { get; set; }
    public int report_id { get; set; }
    public int material_id { get; set; }
    public decimal quantity { get; set; }
    public int unit_id { get; set; }
}

public class ProductionReportWaste
{
    [Key]
    public int id { get; set; }
    public int report_id { get; set; }
    public int material_id { get; set; }
    public int specification_id { get; set; }
    public decimal quantity { get; set; }
    public int unit_id { get; set; }

}

public class ProductionReportOutput
{
    [Key]
    public int id { get; set; }
    public int report_id { get; set; }
    public int product_id { get; set; }
    public decimal quantity { get; set; }
    public int unit_id { get; set; }
    public int batch_number { get; set; }
    public int shelf_life { get; set; }

}



// Сущность WriteOff (списание)
public class WriteOff
{
    [Key]
    public int id { get; set; }
    public string doc_number { get; set; }
    public DateTime date { get; set; }
    public int warehouse_id { get; set; }
    public Warehouse Warehouse { get; set; }
    public string operation_type { get; set; } = "Списание";
    public string responsible { get; set; }
    public string reason { get; set; } // причина списания
    public string comment { get; set; }
    public string? basis { get; set; } // основание
    public DateTime created_at { get; set; } = DateTime.UtcNow;

    public List<WriteOffItem> Items { get; set; } = new();
}

// Сущность WriteOffItem (позиция списания)
public class WriteOffItem
{
    [Key]
    public int id { get; set; }
    public int writeoff_id { get; set; }
    public WriteOff WriteOff { get; set; }

    public int nomenclature_id { get; set; }
    public Nomenclature Nomenclature { get; set; }

    public decimal quantity { get; set; }
}

// DTO для создания списания
public class WriteOffDto
{
    public string doc_number { get; set; }
    public DateTime date { get; set; }
    public int warehouse_id { get; set; }
    public string responsible { get; set; }
    public string reason { get; set; }
    public string comment { get; set; }
    public string? basis { get; set; }
    public List<WriteOffItemDto> items { get; set; }
}

public class WriteOffItemDto
{
    public int nomenclature_id { get; set; }
    public decimal quantity { get; set; }
}


// =================== ПЕРЕМЕЩЕНИЯ ===================

// Сущность Transfer (перемещение)
public class Transfer
{
    [Key]
    public int id { get; set; }
    public string doc_number { get; set; }
    public DateTime date { get; set; }
    public int warehouse_from_id { get; set; }
    public Warehouse WarehouseFrom { get; set; }
    public int warehouse_to_id { get; set; }
    public Warehouse WarehouseTo { get; set; }
    public string responsible { get; set; }
    public string? comment { get; set; }
    public DateTime created_at { get; set; } = DateTime.UtcNow;

    public List<TransferItem> Items { get; set; } = new();
}

// Сущность TransferItem (позиция перемещения)
public class TransferItem
{
    [Key]
    public int id { get; set; }
    public int transfer_id { get; set; }
    public Transfer Transfer { get; set; }

    public int nomenclature_id { get; set; }
    public Nomenclature Nomenclature { get; set; }

    public decimal quantity { get; set; }
}

// DTO для создания перемещения
public class TransferDto
{
    public string doc_number { get; set; }
    public DateTime date { get; set; }
    public int warehouse_from_id { get; set; }
    public int warehouse_to_id { get; set; }
    public string responsible { get; set; }
    public string? comment { get; set; }
    public List<TransferItemDto> items { get; set; }
}

public class TransferItemDto
{
    public int nomenclature_id { get; set; }
    public decimal quantity { get; set; }
}


// --------------------------------------- CONTEXT ------------------------------------------------------------------

public class DairyProductionContext : DbContext
{
    public DairyProductionContext(DbContextOptions<DairyProductionContext> options) : base(options) { }

    public DbSet<Department> departments { get; set; }
    public DbSet<Warehouse> warehouses { get; set; }
    public DbSet<Employee> employees { get; set; }

    public DbSet<Nomenclature> nomenclature { get; set; }
    public DbSet<Warehouse_movements> warehouse_movements { get; set; }

    public DbSet<ProductionReport> productionreport { get; set; }
    public DbSet<ProductionReportMaterial> ProductionReportMaterials { get; set; }
    public DbSet<ProductionReportWaste> ProductionReportWastes { get; set; }
    public DbSet<ProductionReportOutput> ProductionReportOutputs { get; set; }

    public DbSet<Receipt> receipts { get; set; }
    public DbSet<ReceiptItem> receiptitems { get; set; }

    public DbSet<Counterparty> counterparties { get; set; }

    public DbSet<User> users { get; set; }

    public DbSet<WriteOff> writeoffs { get; set; }
    public DbSet<WriteOffItem> writeoffitems { get; set; }

    public DbSet<Transfer> transfers { get; set; }
    public DbSet<TransferItem> transferitems { get; set; }

    public DbSet<ProductionProduct> production_products { get; set; }
    public DbSet<ProductionMaterial> production_materials { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ================= Отчет по производству =================
        modelBuilder.Entity<ProductionReport>(entity =>
        {
            entity.HasKey(r => r.id);

            entity.Property(r => r.department_id).HasColumnName("department_id");
            entity.Property(r => r.warehouse_id).HasColumnName("warehouse_id");
            entity.Property(r => r.responsible).HasColumnName("responsible");
            entity.Property(r => r.doc_number).HasColumnName("doc_number");
            entity.Property(r => r.comment).HasColumnName("comment");

            entity.HasOne(r => r.Department)
                  .WithMany()
                  .HasForeignKey(r => r.department_id)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(r => r.Warehouse)
                  .WithMany()
                  .HasForeignKey(r => r.warehouse_id)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ================= Warehouse_movements =================
        modelBuilder.Entity<Warehouse_movements>(entity =>
        {
            entity.HasKey(w => w.id);

            entity.Property(w => w.warehouse_id).HasColumnName("warehouse_id");
            entity.Property(w => w.nomenclature_id).HasColumnName("nomenclature_id");
            entity.Property(w => w.initial_balance).HasColumnName("initial_balance");
            entity.Property(w => w.incoming).HasColumnName("incoming");
            entity.Property(w => w.outgoing).HasColumnName("outgoing");
            entity.Property(w => w.final_balance).HasColumnName("final_balance");
            entity.Property(w => w.comment).HasColumnName("comment");
            entity.Property(w => w.date).HasColumnName("date");

            entity.HasOne(w => w.Warehouse)
                  .WithMany()
                  .HasForeignKey(w => w.warehouse_id)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(w => w.Nomenclature)
                  .WithMany()
                  .HasForeignKey(w => w.nomenclature_id)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ================= Номенклатура =================
        modelBuilder.Entity<Nomenclature>(entity =>
        {
            entity.HasKey(n => n.id);
            entity.Property(n => n.group_name).HasColumnName("group_name");
            entity.Property(n => n.name).HasColumnName("name");
            entity.Property(n => n.base_unit).HasColumnName("base_unit");
            entity.Property(n => n.type).HasColumnName("type");
            entity.Property(n => n.comment).HasColumnName("comment");
            entity.Property(n => n.number).HasColumnName("number");
        });

        // ================= Склады =================
        modelBuilder.Entity<Warehouse>(entity =>
        {
            entity.HasKey(w => w.id);
            entity.Property(w => w.name).HasColumnName("name");
            entity.Property(w => w.type).HasColumnName("type");
            entity.Property(w => w.address).HasColumnName("address");
            entity.Property(w => w.number).HasColumnName("number");
        });

        // ================= Receipt =================
        modelBuilder.Entity<Receipt>(entity =>
        {
            entity.HasOne(r => r.Сounterparty)
                  .WithMany()
                  .HasForeignKey(r => r.counterparty_id)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(r => r.Warehouse)
                  .WithMany()
                  .HasForeignKey(r => r.warehouse_id)
                  .OnDelete(DeleteBehavior.Restrict);



            entity.HasMany(r => r.Items)
                  .WithOne(i => i.Receipt)
                  .HasForeignKey(i => i.receipt_id)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ReceiptItem>(entity =>
        {
            entity.HasOne(i => i.Nomenclature)
                  .WithMany()
                  .HasForeignKey(i => i.nomenclature_id)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // Конфигурация для User
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(u => u.username);
            entity.Property(u => u.username).HasColumnName("username");
            entity.Property(u => u.password).HasColumnName("password");
            entity.Property(u => u.full_name).HasColumnName("full_name");
            entity.Property(u => u.role).HasColumnName("role");
        });

        // ================= WriteOff =================
        modelBuilder.Entity<WriteOff>(entity =>
        {
            entity.HasKey(w => w.id);

            entity.Property(w => w.doc_number).HasColumnName("doc_number");
            entity.Property(w => w.date).HasColumnName("date");
            entity.Property(w => w.warehouse_id).HasColumnName("warehouse_id");
            entity.Property(w => w.operation_type).HasColumnName("operation_type");
            entity.Property(w => w.responsible).HasColumnName("responsible");
            entity.Property(w => w.reason).HasColumnName("reason");
            entity.Property(w => w.comment).HasColumnName("comment");
            entity.Property(w => w.basis).HasColumnName("basis");
            entity.Property(w => w.created_at).HasColumnName("created_at");

            entity.HasOne(w => w.Warehouse)
                  .WithMany()
                  .HasForeignKey(w => w.warehouse_id)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasMany(w => w.Items)
                  .WithOne(i => i.WriteOff)
                  .HasForeignKey(i => i.writeoff_id)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<WriteOffItem>(entity =>
        {
            entity.HasKey(w => w.id);

            entity.Property(w => w.writeoff_id).HasColumnName("writeoff_id");
            entity.Property(w => w.nomenclature_id).HasColumnName("nomenclature_id");
            entity.Property(w => w.quantity).HasColumnName("quantity");

            entity.HasOne(i => i.WriteOff)
                  .WithMany(w => w.Items)
                  .HasForeignKey(i => i.writeoff_id)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(i => i.Nomenclature)
                  .WithMany()
                  .HasForeignKey(i => i.nomenclature_id)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ================= Transfer (Перемещения) =================
        modelBuilder.Entity<Transfer>(entity =>
        {
            entity.HasKey(t => t.id);

            entity.Property(t => t.doc_number).HasColumnName("doc_number");
            entity.Property(t => t.date).HasColumnName("date");
            entity.Property(t => t.warehouse_from_id).HasColumnName("warehouse_from_id");
            entity.Property(t => t.warehouse_to_id).HasColumnName("warehouse_to_id");
            entity.Property(t => t.responsible).HasColumnName("responsible");
            entity.Property(t => t.comment).HasColumnName("comment");
            entity.Property(t => t.created_at).HasColumnName("created_at");

            entity.HasOne(t => t.WarehouseFrom)
                  .WithMany()
                  .HasForeignKey(t => t.warehouse_from_id)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(t => t.WarehouseTo)
                  .WithMany()
                  .HasForeignKey(t => t.warehouse_to_id)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasMany(t => t.Items)
                  .WithOne(i => i.Transfer)
                  .HasForeignKey(i => i.transfer_id)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TransferItem>(entity =>
        {
            entity.HasKey(t => t.id);

            entity.Property(t => t.transfer_id).HasColumnName("transfer_id");
            entity.Property(t => t.nomenclature_id).HasColumnName("nomenclature_id");
            entity.Property(t => t.quantity).HasColumnName("quantity");

            entity.HasOne(i => i.Transfer)
                  .WithMany(t => t.Items)
                  .HasForeignKey(i => i.transfer_id)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(i => i.Nomenclature)
                  .WithMany()
                  .HasForeignKey(i => i.nomenclature_id)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ================= Production Products =================
        modelBuilder.Entity<ProductionProduct>(entity =>
        {
            entity.HasKey(p => p.id);

            entity.Property(p => p.production_report_id).HasColumnName("production_report_id");
            entity.Property(p => p.nomenclature_id).HasColumnName("nomenclature_id");
            entity.Property(p => p.quantity).HasColumnName("quantity");
            entity.Property(p => p.batch_number).HasColumnName("batch_number");
            entity.Property(p => p.shelf_life).HasColumnName("shelf_life");

            entity.HasOne(p => p.ProductionReport)
                  .WithMany(r => r.Products)
                  .HasForeignKey(p => p.production_report_id)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(p => p.Nomenclature)
                  .WithMany()
                  .HasForeignKey(p => p.nomenclature_id)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ================= Production Materials =================
        modelBuilder.Entity<ProductionMaterial>(entity =>
        {
            entity.HasKey(m => m.id);

            entity.Property(m => m.production_report_id).HasColumnName("production_report_id");
            entity.Property(m => m.nomenclature_id).HasColumnName("nomenclature_id");
            entity.Property(m => m.quantity).HasColumnName("quantity");

            entity.HasOne(m => m.ProductionReport)
                  .WithMany(r => r.Materials)
                  .HasForeignKey(m => m.production_report_id)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(m => m.Nomenclature)
                  .WithMany()
                  .HasForeignKey(m => m.nomenclature_id)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // Модальный конвертер
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(DateTime) || property.ClrType == typeof(DateTime?))
                {
                    property.SetValueConverter(new Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime, DateTime>(
                        v => DateTime.SpecifyKind(v, DateTimeKind.Utc),
                        v => DateTime.SpecifyKind(v, DateTimeKind.Utc)
                    ));
                }
            }
        }

    }

}
