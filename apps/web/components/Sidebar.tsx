"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Icon, { type IconName } from "./Icon";
const groups: { label: string; items: [string, string, IconName][] }[] = [
  { label: "WORKSPACE", items: [["Dashboard", "/dashboard", "dashboard"], ["Leads", "/leads", "leads"], ["Customers", "/customers", "users"]] },
  { label: "PROPERTY & SALES", items: [["Projects", "/projects", "building"], ["Plot inventory", "/plots", "plots"], ["Bookings", "/bookings", "calendar"], ["Payments", "/payments", "wallet"]] },
  { label: "ORGANIZATION", items: [["Team & users", "/users", "briefcase"]] },
];
export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  function logout() {
    localStorage.removeItem("crm_token");
    localStorage.removeItem("crm_user");
    router.push("/");
  }
  return <aside className="sidebar">
    <Link href="/dashboard" className="brand-lockup" aria-label="Real Estate CRM home">
      <span className="brand-mark"><Icon name="building" size={25} /></span>
      <span className="brand-copy">Real Estate<span>CRM WORKSPACE</span></span>
    </Link>
    <div className="workspace-label"><span className="workspace-dot" /> Sales workspace</div>
    <nav className="nav" aria-label="Main navigation">{groups.map(group => <div className="nav-group" key={group.label}>
      <div className="nav-label">{group.label}</div>
      {group.items.map(([label, href, icon]) => <Link key={href} href={href} className={pathname === href || pathname.startsWith(href + "/") ? "active" : ""} aria-current={pathname === href || pathname.startsWith(href + "/") ? "page" : undefined} title={label} aria-label={label}><Icon name={icon} /><span>{label}</span><span className="active-marker" /></Link>)}
    </div>)}</nav>
    <div className="sidebar-foot">
      <div className="sidebar-note"><Icon name="shield" size={22} /><div>Your business, connected.<p>People. Properties. Possibilities.</p></div></div>
      <button className="logout-button" onClick={logout} aria-label="Logout"><Icon name="logout" /><span>Sign out</span></button>
      <div className="sidebar-version">REAL ESTATE CRM <span>v1.0</span></div>
    </div>
  </aside>;
}
