#!/bin/sh
set -eu
umask 077
mkdir -p /backups
while true; do
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  target="/backups/crm-${stamp}.dump"
  pg_dump --format=custom --no-owner --no-acl --file="${target}.partial"
  pg_restore --list "${target}.partial" > /dev/null
  mv "${target}.partial" "$target"
  sha256sum "$target" > "${target}.sha256"
  find /backups -maxdepth 1 -type f -name 'crm-????????T??????Z.dump*' -mtime +14 -delete
  echo "Backup completed at ${stamp}"
  sleep 86400
done
