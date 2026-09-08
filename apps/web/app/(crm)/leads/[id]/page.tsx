"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Topbar from "@/components/Topbar";
import { api, money } from "@/lib/api";
export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<any>(null),
    [err, setErr] = useState(""),
    [status, setStatus] = useState("NEW"),
    [type, setType] = useState("CALL"),
    [note, setNote] = useState(""),
    [next, setNext] = useState("");
  const load = useCallback(() =>
    api<any>(`/leads/${id}`)
      .then((x) => {
        setD(x);
        setStatus(x.status);
      })
      .catch((e) => setErr(e.message)), [id]);
  useEffect(() => {
    if (id) load();
  }, [id, load]);
  async function stage() {
    try {
      await api(`/leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }
  async function activity(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/activities", {
        method: "POST",
        body: JSON.stringify({
          leadId: id,
          type,
          note,
          nextFollowUpAt: next ? new Date(next).toISOString() : undefined,
        }),
      });
      setNote("");
      setNext("");
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }
  return (
    <>
      <Topbar title={d?.name || "Lead Detail"} />
      {err && <div className="error">{err}</div>}
      {!d ? (
        <div className="card">Loading...</div>
      ) : (
        <div className="split">
          <div className="grid" style={{ gap: 16 }}>
            <div className="card">
              <div className="section-title">
                <h2>Lead Profile</h2>
                <span className={`badge ${d.status}`}>{d.status}</span>
              </div>
              <div className="form-grid">
                <Info l="Phone" v={d.phone} />
                <Info l="Email" v={d.email || "—"} />
                <Info l="Source" v={d.source} />
                <Info l="Priority" v={d.priority} />
                <Info l="Budget" v={d.budget ? money(d.budget) : "—"} />
                <Info l="Assigned" v={d.assignedTo?.name || "Unassigned"} />
                <Info
                  l="Preferred Project"
                  v={d.preferredProject?.name || "—"}
                />
                <Info
                  l="Next Follow-up"
                  v={
                    d.nextFollowUpAt
                      ? new Date(d.nextFollowUpAt).toLocaleString()
                      : "—"
                  }
                />
              </div>
              {d.notes && <p className="muted">{d.notes}</p>}
              <div
                className="toolbar"
                style={{ marginTop: 14, marginBottom: 0 }}
              >
                <select aria-label="Lead stage" name="lead-stage"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {[
                    "NEW",
                    "CONTACTED",
                    "QUALIFIED",
                    "SITE_VISIT",
                    "NEGOTIATION",
                    "BOOKED",
                    "WON",
                    "LOST",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                <button className="btn" onClick={stage}>
                  Update Stage
                </button>
              </div>
            </div>
            <div className="card">
              <div className="section-title">
                <h2>Activity Timeline</h2>
              </div>
              {d.activities?.length ? (
                d.activities.map((a: any) => (
                  <div
                    key={a.id}
                    style={{
                      padding: "12px 0",
                      borderBottom: "1px solid #eef1f6",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <b>{a.type}</b>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {new Date(a.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ marginTop: 5 }}>{a.note}</div>
                    <div
                      className="muted"
                      style={{ fontSize: 12, marginTop: 4 }}
                    >
                      {a.user?.name}
                      {a.nextFollowUpAt
                        ? ` · Next: ${new Date(a.nextFollowUpAt).toLocaleString()}`
                        : ""}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty">No activities yet</div>
              )}
            </div>
          </div>
          <div className="card">
            <div className="section-title">
              <h2>Log Activity</h2>
            </div>
            <form onSubmit={activity}>
              <div className="field">
                <label htmlFor="-crm-leads-id-type">Type</label>
                <select id="-crm-leads-id-type" name="-crm-leads-id-type" value={type} onChange={(e) => setType(e.target.value)}>
                  {[
                    "CALL",
                    "WHATSAPP",
                    "EMAIL",
                    "MEETING",
                    "SITE_VISIT",
                    "NOTE",
                    "FOLLOW_UP",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="-crm-leads-id-note">Note</label>
                <textarea id="-crm-leads-id-note" name="-crm-leads-id-note"
                  required
                  rows={5}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="-crm-leads-id-next-follow-up-optional">Next Follow-up (optional)</label>
                <input id="-crm-leads-id-next-follow-up-optional" name="-crm-leads-id-next-follow-up-optional"
                  type="datetime-local"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                />
              </div>
              <button className="btn" style={{ width: "100%" }}>
                Save Activity
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
function Info({ l, v }: any) {
  return (
    <div>
      <div className="stat-label">{l}</div>
      <div style={{ fontWeight: 700, margin: "4px 0 12px" }}>{v}</div>
    </div>
  );
}
