param([Parameter(Mandatory = $true)][string]$BackupPath)
. "$PSScriptRoot/Common.ps1"
$dump = (Resolve-Path -LiteralPath $BackupPath).Path
if (!(Test-Path -LiteralPath "$dump.sha256")) { throw 'Backup checksum file is required' }
$expected = ([IO.File]::ReadAllText("$dump.sha256").Trim() -split '\s+')[0]
if ((Get-FileHash -LiteralPath $dump -Algorithm SHA256).Hash -ne $expected) { throw 'Backup checksum mismatch' }
$container = 'crm_restore_verify_' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
try {
  Invoke-Docker run -d --name $container --network none --tmpfs /var/lib/postgresql/data -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_USER=crm_user -e POSTGRES_DB=crm_restore_test postgres:16-alpine | Out-Null
  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    & docker exec $container pg_isready -U crm_user -d crm_restore_test 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  if (!$ready) { throw 'Restore database did not become ready' }
  Invoke-Docker cp $dump "${container}:/tmp/restore.dump"
  Invoke-Docker exec $container pg_restore -U crm_user -d crm_restore_test --no-owner --no-privileges --exit-on-error /tmp/restore.dump
  Invoke-Docker cp "$PSScriptRoot/database-fingerprint.sql" "${container}:/tmp/fingerprint.sql"
  $fingerprint = Invoke-Docker exec $container psql -X -U crm_user -d crm_restore_test -At -v ON_ERROR_STOP=1 -f /tmp/fingerprint.sql
  [IO.File]::WriteAllLines("$dump.restore-check.txt", [string[]]$fingerprint)
  Write-Output $fingerprint
  Write-Output 'Restore verified in an isolated temporary database; live database was not modified.'
} finally {
  # This name is generated above and belongs only to this isolated restore check.
  & docker rm -f $container | Out-Null
}
