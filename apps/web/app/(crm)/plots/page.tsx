"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import Modal from "@/components/Modal";
import { api, money } from "@/lib/api";
const init = {
  projectId: "",
  plotNo: "",
  sizeKatha: "",
  pricePerKatha: "",
  status: "AVAILABLE",
  facing: "",
  roadWidthFt: "",
};
export default function Plots() {
  const [list, setList] = useState<any[]>([]),
    [projects, setProjects] = useState<any[]>([]),
    [open, setOpen] = useState(false),
    [f, setF] = useState<any>(init),
    [err, setErr] = useState(""),
    [project, setProject] = useState("");
  const load = useCallback(() =>
    api<any[]>("/plots" + (project ? `?projectId=${project}` : ""))
      .then(setList)
      .catch((e) => setErr(e.message)), [project]);
  useEffect(() => {
    api<any[]>("/projects").then((x) => {
      setProjects(x);
      setF((v: any) => ({ ...v, projectId: x[0]?.id || "" }));
    }).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/plots", {
        method: "POST",
        body: JSON.stringify({
          ...f,
          sizeKatha: Number(f.sizeKatha),
          pricePerKatha: Number(f.pricePerKatha),
          roadWidthFt: f.roadWidthFt ? Number(f.roadWidthFt) : undefined,
          facing: f.facing || undefined,
        }),
      });
      setOpen(false);
      setF({ ...init, projectId: projects[0]?.id || "" });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }
  return (
    <>
      <Topbar
        title="Plot Inventory"
        action={
          <button className="btn" onClick={() => setOpen(true)}>
            + New Plot
          </button>
        }
      />
      {err && <div className="error">{err}</div>}
      <div className="card">
        <div className="toolbar">
          <div className="filters">
            <select aria-label="Filter by project" name="project-filter"
              value={project}
              onChange={(e) => setProject(e.target.value)}
            >
              <option value="">All Projects</option>
              {projects.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>
          <div className="muted">{list.length} plots</div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Plot</th>
                <th>Project</th>
                <th>Block</th>
                <th>Size</th>
                <th>Price/Katha</th>
                <th>Total</th>
                <th>Road</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id}>
                  <td>
                    <b>{x.plotNo}</b>
                  </td>
                  <td>{x.project.name}</td>
                  <td>{x.block?.name || "—"}</td>
                  <td>{x.sizeKatha} Katha</td>
                  <td>{money(x.pricePerKatha)}</td>
                  <td>{money(x.totalPrice)}</td>
                  <td>{x.roadWidthFt ? `${x.roadWidthFt} ft` : "—"}</td>
                  <td>
                    <span className={`badge ${x.status}`}>{x.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {open && (
        <Modal title="Add Plot" onClose={() => setOpen(false)}>
          <form className="form-grid" onSubmit={save}>
            <div className="field full">
              <label htmlFor="-crm-plots-project">Project</label>
              <select id="-crm-plots-project" name="-crm-plots-project"
                required
                value={f.projectId}
                onChange={(e) => setF({ ...f, projectId: e.target.value })}
              >
                {projects.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>
            {[
              ["Plot No", "plotNo", "text"],
              ["Size (Katha)", "sizeKatha", "number"],
              ["Price / Katha", "pricePerKatha", "number"],
              ["Road Width (ft)", "roadWidthFt", "number"],
              ["Facing", "facing", "text"],
            ].map(([l, k, t]) => (
              <div className="field" key={k}>
                <label htmlFor={`-crm-plots-${k}`}>{l}</label>
                <input id={`-crm-plots-${k}`} name={k}
                  required={["plotNo", "sizeKatha", "pricePerKatha"].includes(
                    k,
                  )}
                  type={t}
                  value={f[k]}
                  onChange={(e) => setF({ ...f, [k]: e.target.value })}
                />
              </div>
            ))}
            <div className="field">
              <label htmlFor="-crm-plots-status">Status</label>
              <select id="-crm-plots-status" name="-crm-plots-status"
                value={f.status}
                onChange={(e) => setF({ ...f, status: e.target.value })}
              >
                {["AVAILABLE", "HOLD", "BOOKED", "SOLD", "BLOCKED"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
            <button className="btn full">Save Plot</button>
          </form>
        </Modal>
      )}
    </>
  );
}
