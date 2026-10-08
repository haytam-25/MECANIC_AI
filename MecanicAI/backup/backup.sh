#!/bin/sh
# Copia de la base de datos comprimida en /backups. Borra las que tienen más días que los indicados (por defecto
# 14: es lo que promete la política de privacidad para los datos borrados).
# A mano: docker compose exec backup sh /opt/backup/backup.sh
set -eu
set -o pipefail

keep_days="${1:-14}"
name="mecanicai-$(date +%Y-%m-%d_%H%M).sql.gz"
# Si algo falla, no se deja el fichero a medias
trap 'rm -f "/backups/$name.tmp"' EXIT

# --clean --if-exists: al restaurar, la copia sustituye a lo que haya en la base de datos
pg_dump -h db -U mecanicai -d mecanicai --no-owner --clean --if-exists | gzip > "/backups/$name.tmp"
# Solo una copia completa recibe su nombre final (si pg_dump falla a mitad, no queda una copia rota)
mv "/backups/$name.tmp" "/backups/$name"
find /backups -name 'mecanicai-*.sql.gz' -mtime +"$((keep_days - 1))" -delete
# Restos de una copia cortada de golpe (p. ej. si se apagó el servidor a mitad)
find /backups -name 'mecanicai-*.tmp' -mmin +60 -delete

echo "$(date '+%F %T') Copia creada: $name ($(du -h "/backups/$name" | cut -f1))"
