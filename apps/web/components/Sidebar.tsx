"use client";
import { homeFor, routePermission, usePermissions } from "@/lib/permissions";

import BrandLogo from "./BrandLogo";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Icon, { type IconName } from "./Icon";
const groups: { label: string; items: [string, string, IconName][] }[] = [
  { label: "WORKSPACE", items: [["Dashboard", "/dashboard", "dashboard"], ["Leads", "/leads", "leads"], ["Customers", "/customers", "users"]] },
  { label: "PROPERTY & SALES", items: [["Projects", "/projects", "building"], ["Plot inventory", "/plots", "plots"], ["Bookings", "/bookings", "calendar"], ["Payments", "/payments", "wallet"]] },
  { label: "ORGANIZATION", items: [["Team & users", "/users", "briefcase"], ["Roles & Access", "/access", "shield"]] },
];
export default function Sidebar() {
  const {user,can} = usePermissions();
  const visibleGroups = groups.map(group => ({...group,items:group.items.filter(([,href])=>can(routePermission(href.slice(1))))})).filter(group=>group.items.length);
  const router = useRouter();
  const pathname = usePathname();
  function logout() {
    localStorage.removeItem("crm_token");
    localStorage.removeItem("crm_user");
    router.push("/");
  }
  return <aside className="sidebar">
    <Link href={homeFor(user)} className="brand-lockup" aria-label="Anondo Housing Society CRM home">
      <BrandLogo priority />
    </Link>
    <div className="workspace-label"><span className="workspace-dot" /> Sales workspace</div>
    <nav className="nav" aria-label="Main navigation">{visibleGroups.map(group => <div className="nav-group" key={group.label}>
      <div className="nav-label">{group.label}</div>
      {group.items.map(([label, href, icon]) => <Link key={href} href={href} className={pathname === href || pathname.startsWith(href + "/") ? "active" : ""} aria-current={pathname === href || pathname.startsWith(href + "/") ? "page" : undefined} title={label} aria-label={label}><Icon name={icon} /><span>{label}</span><span className="active-marker" /></Link>)}
    </div>)}</nav>
    <div className="sidebar-foot">
      <div className="sidebar-note"><Icon name="shield" size={22} /><div>Your business, connected.<p>People. Properties. Possibilities.</p></div></div>
      <button className="logout-button" onClick={logout} aria-label="Logout"><Icon name="logout" /><span>Sign out</span></button>
      <div className="sidebar-version">ANONDO CRM <span>v1.0</span></div>
    </div>
  </aside>;
}
