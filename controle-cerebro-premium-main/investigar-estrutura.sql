-- ========================================
-- 1. VER COLUNAS DA TABELA tb_processo_parte
-- ========================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'pje'
  AND table_name = 'tb_processo_parte'
ORDER BY ordinal_position;

-- ========================================
-- 2. VER FOREIGN KEYS DA tb_processo_parte
-- ========================================
SELECT
    kcu.column_name AS "Coluna FK",
    ccu.table_name AS "Tabela Referenciada",
    ccu.column_name AS "Coluna Referenciada"
FROM
    information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
WHERE
    tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'pje'
    AND tc.table_name = 'tb_processo_parte';

-- ========================================
-- 3. BUSCAR COLUNAS QUE REFERENCIAM PROCESSO
-- ========================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'pje'
  AND table_name = 'tb_processo_parte'
  AND (column_name ILIKE '%processo%'
       OR column_name ILIKE '%proc%');

-- ========================================
-- 4. AMOSTRA DE DADOS (para ver estrutura real)
-- ========================================
SELECT * FROM pje.tb_processo_parte LIMIT 3;
