#!/bin/sh
# Contenedor de copias de seguridad: programa backup.sh cada día a las 04:00 (hora de España) con el cron de Alpine.
set -eu

# Las tareas de cron no heredan las variables del contenedor: la contraseña va en ~/.pgpass (solo legible por root)
echo "db:5432:mecanicai:mecanicai:${PGPASSWORD}" > /root/.pgpass
chmod 600 /root/.pgpass
unset PGPASSWORD

# Hora local para el cron y para el nombre de los ficheros
if [ -f "/usr/share/zoneinfo/${TZ:-Europe/Madrid}" ]; then
	ln -sf "/usr/share/zoneinfo/${TZ:-Europe/Madrid}" /etc/localtime
fi

echo "0 4 * * * sh /opt/backup/backup.sh ${BACKUP_KEEP_DAYS:-14} > /proc/1/fd/1 2>&1" | crontab -
echo "Copias de seguridad programadas cada día a las 04:00; se guardan ${BACKUP_KEEP_DAYS:-14} días en /backups"
exec crond -f -l 8
