. "$PSScriptRoot/Common.ps1"
Push-Location $ProjectRoot
try {
  # Run this once for an existing db-push installation, after a verified backup.
  $backups = Get-ChildItem -LiteralPath (Join-Path $ProjectRoot 'backups') -Filter '*.dump.restore-check.txt'
  if (!$backups) { throw 'Run Backup-Database.ps1 and Test-Restore.ps1 before baselining' }
  Invoke-Docker compose run --rm --no-deps api npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code
  Invoke-Docker compose run --rm --no-deps api npx prisma migrate resolve --applied 202609080001_baseline
  Invoke-Docker compose run --rm --no-deps api npx prisma migrate deploy
} finally { Pop-Location }
