"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePermissions } from "@/lib/permissions";
import Topbar from "@/components/Topbar";
import Icon, { type IconName } from "@/components/Icon";
import { api, money } from "@/lib/api";
type Lead = { id: string; name: string; phone: string; status: string; nextFollowUpAt?: string; assignedTo?: {name: string}; preferredProject?: {name: string} };
type Summary = { leadCount: number; newLeads: number; customers: number; availablePlots: number; bookedPlots: number; soldPlots: number; totalBookedAmount: number; totalPayments: number; recentLeads: Lead[]; followUps: Lead[] };
export default function Dashboard() {
  const { can } = usePermissions();
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<Summary>("/dashboard/summary").then(setData).catch(e => setError(e.message)); }, []);
  const metrics: { label: string; value: string | number | undefined; icon: IconName; tone: string; note: string; href: string }[] = [
    {label: "Total leads", value: data?.leadCount, icon: "leads", tone: "teal", note: data ? `${data.newLeads} new ${data.newLeads === 1 ? "opportunity" : "opportunities"}` : "Loading opportunities", href: "/leads"},
    {label: "Customers", value: data?.customers, icon: "users", tone: "blue", note: "Relationships in your portfolio", href: "/customers"},
    {label: "Booking value", value: data ? money(data.totalBookedAmount) : undefined, icon: "calendar", tone: "amber", note: "Total amount across bookings", href: "/bookings"},
    {label: "Total payments", value: data ? money(data.totalPayments) : undefined, icon: "wallet", tone: "violet", note: "Collections received to date", href: "/payments"},
  ];
  const available = data?.availablePlots || 0, booked = data?.bookedPlots || 0, sold = data?.soldPlots || 0;
  const total = available + booked + sold;
  const inventory = [{label:"Available",value:available,color:"var(--secondary)"},{label:"Booked",value:booked,color:"var(--primary)"},{label:"Sold",value:sold,color:"var(--tertiary)"}];
  const a = total ? available / total * 100 : 0, b = total ? booked / total * 100 : 0;
  return <>
    <Topbar title="Dashboard" action={can("leads.view") && <Link href="/leads" className="btn"><Icon name="plus" size={17} /> Manage leads</Link>} />
    {error && <div className="error" role="alert">{error}</div>}
    <section className="welcome-banner"><div><span className="banner-kicker"><span /> THE BIG PICTURE</span><h2>Your portfolio, at a glance.</h2><p>Stay close to your customers. Keep your next opportunity in sight.</p>{can("projects.view") && <Link href="/projects">Explore your projects <Icon name="arrow" size={17} /></Link>}</div><svg className="architecture" viewBox="0 0 430 200" fill="none" aria-hidden="true"><path d="M5 185H425 M60 185V68l72-40 73 40v117 M132 28v157 M60 68l72 41 73-41 M132 109v76 M230 185V36l75-25 80 25v149 M305 11v174 M230 36l75 31 80-31 M230 80l75 31 80-31 M230 124l75 31 80-31 M25 185V120l35-21 M385 91l29 14v80" stroke="currentColor" strokeWidth="1.2"/><path d="M78 100v22m18-12v22m18-12v22m38-22v22m18-32v22m18-32v22 M250 69v14m20-6v14m55-14v14m22-24v14m22-24v14 M250 113v14m20-6v14m55-14v14m22-24v14m22-24v14" stroke="currentColor" strokeWidth="3"/></svg></section>
    <div className="dashboard-section-label"><h2>Business overview</h2><span>All-time performance</span></div>
    <section className="grid stats" aria-label="Business metrics">{metrics.filter(m=>can(m.href.slice(1)+".view")).map(m => <Link className="card metric-card" href={m.href} key={m.label}><div className="metric-top"><span className={`icon-tile ${m.tone}`}><Icon name={m.icon} /></span><Icon name="arrowUp" size={16} className="metric-arrow" /></div><div className="metric-label">{m.label}</div><div className="stat-value">{m.value ?? "—"}</div><div className="metric-note">{m.note}</div></Link>)}</section>
    <div className="dashboard-middle">
      {can("plots.view") && <section className="card inventory-card"><div className="section-title"><div><h2>Plot overview</h2><p>Your available, booked and sold inventory</p></div><Link className="icon-button" href="/plots" aria-label="View plot inventory"><Icon name="arrowUp" size={18} /></Link></div><div className="inventory-content"><div className="donut" role="img" aria-label={`${available} available, ${booked} booked, ${sold} sold plots`} style={{background:total?`conic-gradient(var(--secondary) 0% ${a}%, var(--primary) ${a}% ${a+b}%, var(--tertiary) ${a+b}% 100%)`:"var(--border-color)"}}><div><strong>{data ? total : "—"}</strong><span>Plots tracked</span></div></div><div className="inventory-legend">{inventory.map(i => <div key={i.label}><span><i style={{background:i.color}} />{i.label}</span><strong>{data ? i.value : "—"}</strong></div>)}<Link href="/plots" className="text-link">View inventory <Icon name="arrow" size={15} /></Link></div></div></section>}
      {can("activities.view") && <section className="card followups-card"><div className="section-title"><div><h2>Upcoming follow-ups</h2><p>Your next seven days, organized</p></div><span className="icon-tile amber"><Icon name="clock" /></span></div>{!data ? <div className="empty">Loading follow-ups…</div> : data.followUps?.length ? <div className="followup-list">{data.followUps.map(x=><Link className="followup-item" href={`/leads/${x.id}`} key={x.id}><span className="small-avatar">{x.name.charAt(0)}</span><div><strong>{x.name}</strong><span>{x.assignedTo?.name || "Unassigned"} · {new Date(x.nextFollowUpAt!).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</span></div><Icon name="chevron" size={15} /></Link>)}</div> : <div className="empty-state"><span className="empty-icon"><Icon name="calendar" size={27} /></span><h3>You’re all caught up</h3><p>No follow-ups scheduled for the next 7 days.</p><Link href="/leads" className="text-link">Plan your next conversation <Icon name="arrow" size={15} /></Link></div>}</section>}
    </div>
    {can("leads.view") && <section className="card recent-card"><div className="section-title"><div><h2>Recent leads <span className="count-pill">{data?.recentLeads?.length ?? "—"}</span></h2><p>The latest opportunities in your pipeline</p></div><Link href="/leads" className="text-link">View all leads <Icon name="arrow" size={16} /></Link></div><div className="table-wrap"><table className="table"><thead><tr><th>Lead</th><th>Status</th><th>Assigned to</th><th>Interested project</th><th><span className="sr-only">Open lead</span></th></tr></thead><tbody>{data?.recentLeads?.map(x=><tr key={x.id}><td><Link href={`/leads/${x.id}`} className="person-cell"><span className="small-avatar">{x.name.charAt(0)}</span><span><strong>{x.name}</strong><small>{x.phone}</small></span></Link></td><td><span className={`badge ${x.status}`}>{x.status.replaceAll("_"," ")}</span></td><td>{x.assignedTo?.name || "Unassigned"}</td><td><span className="inline-icon"><Icon name="building" size={15} />{x.preferredProject?.name || "No project selected"}</span></td><td><Link href={`/leads/${x.id}`} className="icon-button" aria-label={`Open ${x.name}`}><Icon name="arrowUp" size={16} /></Link></td></tr>)}</tbody></table></div>{data && !data.recentLeads?.length && <div className="empty">Your next opportunity starts with a new lead.</div>}</section>}
    <footer className="page-footer"><span>Anondo Housing Society</span><span>Built around your business.</span></footer>
  </>;
}
