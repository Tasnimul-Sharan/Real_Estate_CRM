"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { usePermissions } from "@/lib/permissions";
import Topbar from "@/components/Topbar";
import Modal from "@/components/Modal";
import { api } from "@/lib/api";
const init = {
  name: "",
  code: "",
  location: "",
  description: "",
  status: "ACTIVE",
  totalArea: "",
};
export default function Projects() {
  const permissions = usePermissions();
  const [list, setList] = useState<any[]>([]),
    [open, setOpen] = useState(false),
    [f, setF] = useState<any>(init),
    [err, setErr] = useState("");
  const load = useCallback(() =>
    api<any[]>("/projects")
      .then(setList)
      .catch((e) => setErr(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/projects", {
        method: "POST",
        body: JSON.stringify({
          ...f,
          totalArea: f.totalArea ? Number(f.totalArea) : undefined,
          description: f.description || undefined,
        }),
      });
      setF(init);
      setOpen(false);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }
  return (
    <>
      <Topbar
        title="Projects"
        action={permissions.can('projects.create') && (
          <button className="btn" onClick={() => setOpen(true)}>
            <Icon name="plus" size={16} /> New Project
          </button>
        )}
      />
      {err && <div className="error">{err}</div>}
      <div className="grid stats">
        {list.map((x) => (
          <div className="card" key={x.id}>
            <div className="stat-label">{x.code}</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>
              {x.name}
            </div>
            <div
              className="muted"
              style={{ fontSize: 13, margin: "6px 0 12px" }}
            >
              {x.location}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="badge">{x.status}</span>
              <span className="badge">{x._count?.plots || 0} plots</span>
              <span className="badge">{x._count?.leads || 0} leads</span>
            </div>
          </div>
        ))}
      </div>
      {open && (
        <Modal title="Create Project" onClose={() => setOpen(false)}>
          {err && <div className="error" role="alert">{err}</div>}
          <form className="form-grid" onSubmit={save}>
            {[
              ["Name", "name"],
              ["Code", "code"],
              ["Location", "location"],
              ["Total Area", "totalArea"],
            ].map(([l, k]) => (
              <div className="field" key={k}>
                <label htmlFor={`-crm-projects-${k}`}>{l}</label>
                <input id={`-crm-projects-${k}`} name={k}
                  required={k !== "totalArea"}
                  type={k === "totalArea" ? "number" : "text"}
                  value={f[k]}
                  onChange={(e) => setF({ ...f, [k]: e.target.value })}
                />
              </div>
            ))}
            <div className="field">
              <label htmlFor="-crm-projects-status">Status</label>
              <select id="-crm-projects-status" name="-crm-projects-status"
                value={f.status}
                onChange={(e) => setF({ ...f, status: e.target.value })}
              >
                {["PLANNING", "ACTIVE", "COMPLETED", "ON_HOLD"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="-crm-projects-description">Description</label>
              <textarea id="-crm-projects-description" name="-crm-projects-description"
                rows={3}
                value={f.description}
                onChange={(e) => setF({ ...f, description: e.target.value })}
              />
            </div>
            <button className="btn full">Save Project</button>
          </form>
        </Modal>
      )}
    </>
  );
}
