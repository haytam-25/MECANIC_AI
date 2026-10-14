-- Matrícula del coche (opcional): se pide al final del asistente, se guarda en mayúsculas y sin espacios ni guiones
-- (ej.: 1234BCD) y sale en el PDF del Historial de reparaciones. No se envía a la IA.
ALTER TABLE vehicle ADD COLUMN plate VARCHAR(12);
