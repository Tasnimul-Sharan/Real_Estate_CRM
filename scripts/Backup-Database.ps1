param([string]$Container = 'real_estate_crm_nestjs_complete-db-1')
. "$PSScriptRoot/Common.ps1"
$destination = Join-Path $ProjectRoot 'backups'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$filename = "crm-$stamp.dump"
$dump = Join-Path $destination $filename
Invoke-Docker exec $Container pg_dump -U crm_user -d realestate_crm --format=custom --no-owner --no-acl --file="/tmp/$filename"
Invoke-Docker exec $Container pg_restore --list "/tmp/$filename" | Out-Null
Invoke-Docker cp "${Container}:/tmp/$filename" $dump
Invoke-Docker exec $Container rm -- "/tmp/$filename"
$hash = (Get-FileHash -LiteralPath $dump -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText("$dump.sha256", "$hash  $filename`n")
Write-Output $dump
