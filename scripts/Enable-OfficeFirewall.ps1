#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
$log = Join-Path $PSScriptRoot 'lan-firewall-result.txt'
try {
  $address = Get-NetIPAddress -AddressFamily IPv4 -IPAddress '192.168.10.28'
  foreach ($port in @(3000,4000)) {
    $name = "AnondoCRM-OfficeLAN-$port"
    $existing = Get-NetFirewallRule -Name $name -ErrorAction SilentlyContinue
    if ($existing) { Remove-NetFirewallRule -Name $name }
    New-NetFirewallRule -Name $name -DisplayName "Anondo CRM office LAN TCP $port" -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port -LocalAddress '192.168.10.28' -RemoteAddress '192.168.10.0/23' -InterfaceAlias $address.InterfaceAlias -Profile Any | Out-Null
  }
  'SUCCESS: CRM TCP 3000 and 4000 allowed only from 192.168.10.0/23 to 192.168.10.28.' | Set-Content $log
} catch {
  ('FAILED: ' + $_.Exception.Message) | Set-Content $log
  exit 1
}
