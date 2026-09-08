param([string]$AdminEmail = 'admin@crm.local')
. "$PSScriptRoot/Common.ps1"
$config = Join-Path $ProjectRoot '.env'
if (Test-Path -LiteralPath $config) { throw '.env already exists; refusing to replace existing credentials' }
function New-RandomSecret {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
}
$dbPassword = New-RandomSecret
$jwtSecret = New-RandomSecret
$adminPassword = New-RandomSecret
$secretDir = Join-Path $ProjectRoot '.secrets'
New-Item -ItemType Directory -Force -Path $secretDir | Out-Null
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls $secretDir /inheritance:r /grant:r "${identity}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict secrets directory access' }
[IO.File]::WriteAllText($config, "POSTGRES_PASSWORD=$dbPassword`nJWT_SECRET=$jwtSecret`nCORS_ORIGIN=http://localhost:3000`nNEXT_PUBLIC_API_URL=http://localhost:4000/api`nENABLE_API_DOCS=false`n")
& icacls $config /inheritance:r /grant:r "${identity}:F" 'SYSTEM:F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict configuration access' }
[IO.File]::WriteAllText((Join-Path $secretDir 'admin.env'), "ADMIN_EMAIL=$AdminEmail`nADMIN_PASSWORD=$adminPassword`nROTATE_ADMIN_PASSWORD=true`n")
[IO.File]::WriteAllText((Join-Path $secretDir 'administrator-login.txt'), "CRM: http://localhost:3000`nEmail: $AdminEmail`nPassword: $adminPassword`n")
# SQL contains a generated hexadecimal password, never user-provided SQL text.
[IO.File]::WriteAllText((Join-Path $secretDir 'rotate-database.sql'), "ALTER ROLE crm_user WITH PASSWORD '$dbPassword';`n")
[IO.File]::WriteAllText((Join-Path $secretDir 'local-api.env'), "DATABASE_URL=postgresql://crm_user:${dbPassword}@localhost:5432/realestate_crm?schema=public`nJWT_SECRET=$jwtSecret`nJWT_EXPIRES_IN=8h`nCORS_ORIGIN=http://localhost:3000`nENABLE_API_DOCS=false`n")
Write-Output 'Generated private configuration and administrator login under .secrets. Credentials were not printed.'
