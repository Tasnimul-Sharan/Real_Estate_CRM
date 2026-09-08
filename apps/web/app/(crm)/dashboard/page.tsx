"use client";
import { useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import { api, money } from "@/lib/api";
export default function Dashboard() {
  const [d, setD] = useState<any>(null);
  const [e, setE] = useState("");
  useEffect(() => {
    api("/dashboard/summary")
      .then(setD)
      .catch((x) => setE(x.message));
  }, []);
  return (
    <>
      <Topbar title="Dashboard" />
      {e && <div className="error">{e}</div>}
      <div className="grid stats">
        {[
          ["Total Leads", d?.leadCount],
          ["New Leads", d?.newLeads],
          ["Available Plots", d?.availablePlots],
          ["Customers", d?.customers],
          ["Booked Plots", d?.bookedPlots],
          ["Sold Plots", d?.soldPlots],
          ["Booking Value", money(d?.totalBookedAmount)],
          ["Payments", money(d?.totalPayments)],
        ].map(([a, b]) => (
          <div className="card" key={a}>
            <div className="stat-label">{a}</div>
            <div className="stat-value">{b ?? "—"}</div>
          </div>
        ))}
      </div>
      <div className="split">
        <div className="card">
          <div className="section-title">
            <h2>Recent Leads</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Assigned</th>
                  <th>Project</th>
                </tr>
              </thead>
              <tbody>
                {d?.recentLeads?.map((x: any) => (
                  <tr key={x.id}>
                    <td>{x.name}</td>
                    <td>{x.phone}</td>
                    <td>
                      <span className={`badge ${x.status}`}>{x.status}</span>
                    </td>
                    <td>{x.assignedTo?.name || "—"}</td>
                    <td>{x.preferredProject?.name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="section-title">
            <h2>Next 7 Days Follow-ups</h2>
          </div>
          {d?.followUps?.length ? (
            d.followUps.map((x: any) => (
              <div
                key={x.id}
                style={{ padding: "12px 0", borderBottom: "1px solid #eef1f6" }}
              >
                <b>{x.name}</b>
                <div className="muted" style={{ fontSize: 12 }}>
                  {x.phone} · {x.assignedTo?.name || "Unassigned"}
                </div>
                <div className="kpi-note">
                  {new Date(x.nextFollowUpAt).toLocaleString()}
                </div>
              </div>
            ))
          ) : (
            <div className="empty">No scheduled follow-ups</div>
          )}
        </div>
      </div>
    </>
  );
}
