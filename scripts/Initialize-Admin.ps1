param([switch]$RotateExisting)
. "$PSScriptRoot/Common.ps1"
$values = @{}
foreach ($line in Get-Content -LiteralPath (Join-Path $ProjectRoot '.secrets/admin.env')) {
  if ($line -match '^([^=]+)=(.*)$') { $values[$matches[1]] = $matches[2] }
}
$oldEmail = $env:ADMIN_EMAIL
$oldPassword = $env:ADMIN_PASSWORD
$oldRotate = $env:ROTATE_ADMIN_PASSWORD
Push-Location $ProjectRoot
try {
  $env:ADMIN_EMAIL = $values['ADMIN_EMAIL']
  $env:ADMIN_PASSWORD = $values['ADMIN_PASSWORD']
  $env:ROTATE_ADMIN_PASSWORD = if ($RotateExisting) { 'true' } else { 'false' }
  Invoke-Docker compose run --rm --no-deps -e ADMIN_EMAIL -e ADMIN_PASSWORD -e ROTATE_ADMIN_PASSWORD api npm run bootstrap:admin
} finally {
  $env:ADMIN_EMAIL = $oldEmail
  $env:ADMIN_PASSWORD = $oldPassword
  $env:ROTATE_ADMIN_PASSWORD = $oldRotate
  Pop-Location
}
