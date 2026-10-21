-- Hasta ahora la caché de planes de mantenimiento usaba los ids de marca y modelo que enviaba el navegador sin
-- comprobarlos, y a la IA le llegaban los nombres escritos: se podía guardar la respuesta de otro coche (o de un texto
-- manipulado) como la de un coche del catálogo. Las claves nuevas (v2) solo usan ids del catálogo con sus nombres; las
-- antiguas se borran por si alguna se envenenó (cada coche se vuelve a consultar una vez).
DELETE FROM maintenance_cache WHERE cache_key LIKE 'v1|%';
