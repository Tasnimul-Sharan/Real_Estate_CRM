param(
  [Parameter(Mandatory=$true)][string]$BackupFile,
  [string]$PythonCommand = 'python',
  [switch]$Apply
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$inputFile = (Resolve-Path -LiteralPath $BackupFile).Path
if (-not (Test-Path -LiteralPath $inputFile -PathType Leaf)) { throw 'Supply one SQL backup file.' }
function Invoke-LegacyDocker {
  # Windows PowerShell 5.1 treats native progress stderr as an error record.
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & docker @args; $code = $LASTEXITCODE } finally { $ErrorActionPreference = $previous }
  if ($code -ne 0) { throw "Docker operation failed (exit $code). No further import steps will run." }
}
$privateFolder = Join-Path $projectRoot 'backups/legacy'
New-Item -ItemType Directory -Force -Path $privateFolder | Out-Null
$runId = [Guid]::NewGuid().ToString('N')
$manifest = Join-Path $privateFolder "manifest-$runId.json"
$remote = "/tmp/legacy-$runId.json"
$copied = $false
Push-Location $projectRoot
try {
  & $PythonCommand (Join-Path $PSScriptRoot 'legacy/parse_legacy_backup.py') --input $inputFile --output $manifest
  if ($LASTEXITCODE -ne 0) { throw 'Backup validation failed; no database changes were made.' }
  Invoke-LegacyDocker compose cp $manifest "api:$remote"
  $copied = $true
  Invoke-LegacyDocker compose exec -T api node scripts/import-legacy.cjs --input $remote
  if ($Apply) {
    $stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
    $backupName = "crm-before-legacy-$stamp-$runId.dump"
    $backupPath = Join-Path $privateFolder $backupName
    Invoke-LegacyDocker compose exec -T db pg_dump -U crm_user -d realestate_crm --format=custom --no-owner --no-acl --file="/tmp/$backupName"
    Invoke-LegacyDocker compose exec -T db pg_restore --list "/tmp/$backupName" | Out-Null
    Invoke-LegacyDocker compose cp "db:/tmp/$backupName" $backupPath
    $hash = (Get-FileHash -LiteralPath $backupPath -Algorithm SHA256).Hash.ToLowerInvariant()
    [IO.File]::WriteAllText("$backupPath.sha256", "$hash  $backupName`n")
    Invoke-LegacyDocker compose exec -T db rm -- "/tmp/$backupName"
    Write-Output "Database backup verified: $backupPath"
    Invoke-LegacyDocker compose exec -T api node scripts/import-legacy.cjs --input $remote --apply
  } else {
    Write-Output 'Dry run complete. Add -Apply to import after reviewing the counts above.'
  }
  Write-Output "Sanitized manifest retained privately: $manifest"
} finally {
  if ($copied) {
    # Remove only this invocation's generated container temp file.
    & docker compose exec -T api rm -- $remote | Out-Null
  }
  Pop-Location
}
