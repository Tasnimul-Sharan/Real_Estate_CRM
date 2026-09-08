"use client";
import { FormEvent, useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { usePermissions } from "@/lib/permissions";
import Topbar from "@/components/Topbar";
import Modal from "@/components/Modal";
import { api, money } from "@/lib/api";
const init = {
  name: "",
  phone: "",
  email: "",
  source: "FACEBOOK",
  priority: "MEDIUM",
  budget: "",
  preferredProjectId: "",
  assignedToId: "",
  notes: "",
};
export default function Leads() {
  const permissions = usePermissions();
  const [list, setList] = useState<any[]>([]),
    [projects, setProjects] = useState<any[]>([]),
    [users, setUsers] = useState<any[]>([]),
    [open, setOpen] = useState(false),
    [form, setForm] = useState<any>(init),
    [error, setError] = useState(""),
    [q, setQ] = useState("");
  const load = useCallback((query = "") =>
    api<any[]>("/leads" + (query ? `?q=${encodeURIComponent(query)}` : ""))
      .then(setList)
      .catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
    api<any[]>("/projects").then(setProjects).catch((e) => setError(e.message));
    api<any[]>("/users").then(setUsers).catch((e) => setError(e.message));
  }, [load]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/leads", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          budget: form.budget ? Number(form.budget) : undefined,
          preferredProjectId: form.preferredProjectId || undefined,
          assignedToId: form.assignedToId || undefined,
          email: form.email || undefined,
        }),
      });
      setForm(init);
      setOpen(false);
      load(q);
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <>
      <Topbar
        title="Leads"
        action={permissions.sales && (
          <button className="btn" onClick={() => setOpen(true)}>
            <Icon name="plus" size={16} /> New Lead
          </button>
        )}
      />
      {error && <div className="error">{error}</div>}
      <div className="card">
        <div className="toolbar">
          <div className="filters">
            <input
              aria-label="Search leads" name="lead-search" placeholder="Search name / phone / email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="btn secondary" onClick={() => load(q)}>
              <Icon name="search" size={15} /> Search
            </button>
          </div>
          <div className="muted">{list.length} leads</div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Source</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Budget</th>
                <th>Project</th>
                <th>Assigned</th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id}>
                  <td>
                    <Link
                      href={`/leads/${x.id}`}
                      style={{ fontWeight: 600, color: "var(--teal)" }}
                    >
                      {x.name}
                    </Link>
                  </td>
                  <td>{x.phone}</td>
                  <td>{x.source}</td>
                  <td>
                    <span className={`badge ${x.status}`}>{x.status}</span>
                  </td>
                  <td>{x.priority}</td>
                  <td>{x.budget ? money(x.budget) : "—"}</td>
                  <td>{x.preferredProject?.name || "—"}</td>
                  <td>{x.assignedTo?.name || "Unassigned"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {open && (
        <Modal title="Create Lead" onClose={() => setOpen(false)}>
          {error && <div className="error" role="alert">{error}</div>}
          <form onSubmit={submit} className="form-grid">
            <F
              l="Full name"
              v={form.name}
              s={(v: any) => setForm({ ...form, name: v })}
            />
            <F
              l="Phone"
              v={form.phone}
              s={(v: any) => setForm({ ...form, phone: v })}
            />
            <F
              l="Email"
              v={form.email}
              s={(v: any) => setForm({ ...form, email: v })}
            />
            <F
              l="Budget (BDT)"
              t="number"
              v={form.budget}
              s={(v: any) => setForm({ ...form, budget: v })}
            />
            <Sel
              l="Source"
              v={form.source}
              s={(v: any) => setForm({ ...form, source: v })}
              o={[
                "FACEBOOK",
                "GOOGLE",
                "WEBSITE",
                "WALK_IN",
                "REFERRAL",
                "CALL",
                "WHATSAPP",
                "EVENT",
                "OTHER",
              ]}
            />
            <Sel
              l="Priority"
              v={form.priority}
              s={(v: any) => setForm({ ...form, priority: v })}
              o={["LOW", "MEDIUM", "HIGH", "URGENT"]}
            />
            <Sel
              l="Preferred Project"
              v={form.preferredProjectId}
              s={(v: any) => setForm({ ...form, preferredProjectId: v })}
              o={projects.map((x) => [x.id, x.name])}
              blank="None"
            />
            <Sel
              l="Assigned To"
              v={form.assignedToId}
              s={(v: any) => setForm({ ...form, assignedToId: v })}
              o={users.map((x) => [x.id, x.name])}
              blank="Unassigned"
            />
            <div className="field full">
              <label htmlFor="-crm-leads-notes">Notes</label>
              <textarea id="-crm-leads-notes" name="-crm-leads-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <button className="btn full">Save Lead</button>
          </form>
        </Modal>
      )}
    </>
  );
}
function F({ l, v, s, t = "text" }: any) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{l}</label>
      <input id={id} name={l}
        required={l === "Full name" || l === "Phone"}
        type={t}
        value={v}
        onChange={(e) => s(e.target.value)}
      />
    </div>
  );
}
function Sel({ l, v, s, o, blank }: any) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{l}</label>
      <select id={id} name={l} value={v} onChange={(e) => s(e.target.value)}>
        {blank && <option value="">{blank}</option>}
        {o.map((x: any) =>
          Array.isArray(x) ? (
            <option key={x[0]} value={x[0]}>
              {x[1]}
            </option>
          ) : (
            <option key={x}>{x}</option>
          ),
        )}
      </select>
    </div>
  );
}
