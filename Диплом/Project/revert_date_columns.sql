-- Скрипт для ОТКАТА изменений - возврат типа колонок date с TIMESTAMP обратно на DATE
-- Выполните этот скрипт в вашей базе данных PostgreSQL, если хотите вернуть как было

-- Возвращаем тип колонок на DATE для всех таблиц с полем date

-- 1. ProductionReport (productionreport)
ALTER TABLE productionreport 
ALTER COLUMN date TYPE DATE USING date::DATE;

-- 2. Receipt (receipts)
ALTER TABLE receipts 
ALTER COLUMN date TYPE DATE USING date::DATE;

-- 3. WriteOff (writeoffs)
ALTER TABLE writeoffs 
ALTER COLUMN date TYPE DATE USING date::DATE;

-- 4. Transfer (transfers)
ALTER TABLE transfers 
ALTER COLUMN date TYPE DATE USING date::DATE;

-- 5. Warehouse_movements (warehouse_movements)
ALTER TABLE warehouse_movements 
ALTER COLUMN date TYPE DATE USING date::DATE;

-- Проверяем результат
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE column_name = 'date' 
    AND table_schema = 'public'
ORDER BY table_name;

