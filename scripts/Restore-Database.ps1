param([Parameter(Mandatory = $true)][string]$BackupPath, [Parameter(Mandatory = $true)][string]$TargetDatabase)
. "$PSScriptRoot/Common.ps1"
# Restore only into a new database; never drop, clean or overwrite the live CRM database.
if ($TargetDatabase -notmatch '^crm_restore_[a-z0-9_]+$') { throw 'Target must be a new database named crm_restore_<name>' }
$dump = (Resolve-Path -LiteralPath $BackupPath).Path
if (!(Test-Path -LiteralPath "$dump.sha256")) { throw 'Backup checksum file is required' }
$expected = ([IO.File]::ReadAllText("$dump.sha256").Trim() -split '\s+')[0]
if ((Get-FileHash -LiteralPath $dump -Algorithm SHA256).Hash -ne $expected) { throw 'Backup checksum mismatch' }
$container = 'real_estate_crm_nestjs_complete-db-1'
Invoke-Docker exec $container createdb -U crm_user $TargetDatabase
Invoke-Docker cp $dump "${container}:/tmp/$TargetDatabase.dump"
try {
  Invoke-Docker exec $container pg_restore -U crm_user -d $TargetDatabase --no-owner --no-privileges --exit-on-error "/tmp/$TargetDatabase.dump"
  Write-Output "Restored into $TargetDatabase. Verify it before a separately planned application cutover."
} finally { Invoke-Docker exec $container rm -- "/tmp/$TargetDatabase.dump" }
