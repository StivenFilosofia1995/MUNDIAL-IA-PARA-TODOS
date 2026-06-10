-- ============================================================
-- ACTUALIZACIÓN: dinero + goleadores + vista mejorada
-- Ejecutar en Supabase SQL Editor (después del schema.sql inicial)
-- ============================================================

-- 1. Agregar columna goleadores a resultados
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS goleadores TEXT DEFAULT '';

-- 2. Reconstruir v_tabla con pesos ($500 acierto, $1.500 exacto)
CREATE OR REPLACE VIEW v_tabla AS
SELECT
  u.id,
  u.nombre,
  u.apellido,
  u.nombre || ' ' || u.apellido        AS nombre_completo,
  COALESCE(COUNT(r.id), 0)             AS evaluados,
  COALESCE(SUM(CASE
    WHEN a.goles_local = r.goles_local AND a.goles_vis = r.goles_vis THEN 3
    WHEN SIGN(a.goles_local - a.goles_vis) = SIGN(r.goles_local - r.goles_vis) THEN 1
    ELSE 0
  END), 0)                             AS puntos,
  COALESCE(SUM(CASE
    WHEN a.goles_local = r.goles_local AND a.goles_vis = r.goles_vis THEN 1500
    WHEN SIGN(a.goles_local - a.goles_vis) = SIGN(r.goles_local - r.goles_vis) THEN 500
    ELSE 0
  END), 0)                             AS pesos,
  COALESCE(SUM(CASE
    WHEN a.goles_local = r.goles_local AND a.goles_vis = r.goles_vis THEN 1 ELSE 0
  END), 0)                             AS exactos,
  COALESCE(SUM(CASE
    WHEN a.goles_local IS NOT NULL AND a.goles_vis IS NOT NULL
      AND (a.goles_local != r.goles_local OR a.goles_vis != r.goles_vis)
      AND SIGN(a.goles_local - a.goles_vis) = SIGN(r.goles_local - r.goles_vis) THEN 1 ELSE 0
  END), 0)                             AS aciertos
FROM usuarios u
LEFT JOIN apuestas   a ON a.usuario_id = u.id
LEFT JOIN resultados r ON r.partido_id = a.partido_id
  AND a.goles_local IS NOT NULL AND a.goles_vis IS NOT NULL
GROUP BY u.id, u.nombre, u.apellido
ORDER BY puntos DESC NULLS LAST, exactos DESC NULLS LAST;

GRANT SELECT ON v_tabla TO anon;
GRANT SELECT ON v_tabla TO authenticated;
