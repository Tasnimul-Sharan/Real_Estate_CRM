"use client";
import { useEffect, useState } from "react";
import Icon from "./Icon";
const descriptions: Record<string, string> = {
  "Roles & Access": "Decide which features each role can view and manage.",
  Dashboard: "A clear picture of your sales, properties and priorities.",
  Leads: "Turn every conversation into a new opportunity.",
  Customers: "Build lasting relationships with your customers.",
  Projects: "Your property portfolio, beautifully organized.",
  "Plot Inventory": "Keep every plot and its availability in view.",
  Bookings: "Manage reservations and keep your sales moving.",
  Payments: "A complete view of your customer collections.",
  "Team & Users": "The people bringing your business forward.",
};
export default function Topbar({ title, action }: { title: string; action?: React.ReactNode }) {
  const [user, setUser] = useState<{ name?: string; role?: string } | null>(null);
  const [date, setDate] = useState("");
  useEffect(() => {
    try { setUser(JSON.parse(localStorage.getItem("crm_user") || "null")); } catch {}
    setDate(new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date()));
  }, []);
  const initials = (user?.name || "User").split(" ").map(s => s[0]).slice(0, 2).join("");
  return <>
    <header className="workspace-bar">
      <div className="breadcrumb"><Icon name="home" size={16} /><span>Workspace</span><Icon name="chevron" size={12} /><strong>{title}</strong></div>
      <div className="workspace-bar-right"><span className="date-label"><Icon name="calendar" size={16} />{date}</span><div className="user-profile"><span className="avatar">{initials}</span><div><strong>{user?.name || "User"}</strong><span>{(user?.role || "Workspace member").replaceAll("_", " ").toLowerCase()}</span></div></div></div>
    </header>
    <div className="topbar"><div><div className="eyebrow">YOUR WORKSPACE</div><h1>{title}</h1><p>{descriptions[title] || "Every detail you need to move this relationship forward."}</p></div><div className="topbar-actions">{action}</div></div>
  </>;
}
