# Office LAN access

Current host: 192.168.10.28. Office subnet: 192.168.10.0/23.
Open http://192.168.10.28:3000 from another PC on this office network and sign in using its CRM account.

Start/rebuild from D:\Office Project\Real_Estate_CRM:

```powershell
docker compose -f docker-compose.yml -f docker-compose.lan.yml up -d --build api web
```

Docker Desktop must be running on this PC. CRM binds only to the office IP because another application uses localhost ports 3000/4000. Use the LAN URL on this PC too. Database port remains bound exclusively to loopback. The LAN override sets the browser API URL at build time and permits both localhost and the office address through CORS.

Firewall setup requires an administrator: run scripts/Enable-OfficeFirewall.ps1. Its two inbound TCP rules are restricted to the Ethernet adapter owning 192.168.10.28, that local address, and remote subnet 192.168.10.0/23. The script records its outcome in scripts/lan-firewall-result.txt.

Reserve 192.168.10.28 for this PC in the office router's DHCP configuration. If the PC address changes, update the LAN compose file and firewall script, rebuild, and reapply the firewall rules. No router port forwarding is required for office access.

This setup runs the current CRM on this PC. It does not migrate the application or old CRM data to the Windows Server.

