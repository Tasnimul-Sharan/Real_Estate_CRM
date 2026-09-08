"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
const items = [
  ["Dashboard", "/dashboard", "▦"],
  ["Leads", "/leads", "◎"],
  ["Customers", "/customers", "♙"],
  ["Projects", "/projects", "◆"],
  ["Plots", "/plots", "▤"],
  ["Bookings", "/bookings", "▣"],
  ["Payments", "/payments", "৳"],
  ["Team", "/users", "♟"],
];
export default function Sidebar() {
  const r = useRouter();
  function logout() {
    localStorage.removeItem("crm_token");
    localStorage.removeItem("crm_user");
    r.push("/");
  }
  return (
    <aside className="sidebar">
      <div className="brand">
        RE <span>CRM</span>
      </div>
      <nav className="nav">
        {items.map(([n, h, i]) => (
          <Link key={h} href={h} aria-label={n} title={n}>
            {i} <span>{n}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-foot">
        <button
          className="btn secondary"
          style={{ width: "100%" }}
          aria-label="Logout"
          onClick={logout}
        >
          ↪ <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
