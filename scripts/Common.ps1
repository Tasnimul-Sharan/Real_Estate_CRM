$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
function Invoke-Docker {
  & docker @args
  if ($LASTEXITCODE -ne 0) { throw "Docker command failed (exit $LASTEXITCODE)" }
}
