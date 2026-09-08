. "$PSScriptRoot/Common.ps1"
Push-Location $ProjectRoot
try {
  Invoke-Docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests
} finally {
  # Fixed test project uses temporary memory-backed data, never the live volume.
  & docker compose -f docker-compose.test.yml down
  Pop-Location
}
