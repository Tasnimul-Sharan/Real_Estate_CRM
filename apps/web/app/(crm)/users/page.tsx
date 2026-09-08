"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import Topbar from "@/components/Topbar";
import Modal from "@/components/Modal";
import { api } from "@/lib/api";
const init = {
  name: "",
  email: "",
  phone: "",
  password: "",
  role: "SALES_EXECUTIVE",
};
export default function Users() {
  const [list, setList] = useState<any[]>([]),
    [open, setOpen] = useState(false),
    [f, setF] = useState<any>(init),
    [err, setErr] = useState(""),
    [canAdmin, setCanAdmin] = useState(false);
  const load = useCallback(() =>
    api<any[]>("/users")
      .then(setList)
      .catch((e) => setErr(e.message)), []);
  useEffect(() => {
    load();
    try {
      const me = JSON.parse(localStorage.getItem("crm_user") || "null");
      setCanAdmin(["SUPER_ADMIN", "ADMIN"].includes(me?.role));
    } catch {}
  }, [load]);
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/users", {
        method: "POST",
        body: JSON.stringify({ ...f, phone: f.phone || undefined }),
      });
      setOpen(false);
      setF(init);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }
  return (
    <>
      <Topbar
        title="Team & Users"
        action={
          canAdmin ? (
            <button className="btn" onClick={() => setOpen(true)}>
              <Icon name="plus" size={16} /> New User
            </button>
          ) : undefined
        }
      />
      {err && <div className="error">{err}</div>}
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id}>
                  <td>
                    <b>{x.name}</b>
                  </td>
                  <td>{x.email}</td>
                  <td>{x.phone || "—"}</td>
                  <td>
                    <span className="badge">{x.role}</span>
                  </td>
                  <td>{x.status}</td>
                  <td>{new Date(x.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {open && (
        <Modal title="Create User" onClose={() => setOpen(false)}>
          <form className="form-grid" onSubmit={save}>
            {[
              ["Name", "name", "text"],
              ["Email", "email", "email"],
              ["Phone", "phone", "text"],
              ["Password", "password", "password"],
            ].map(([l, k, t]) => (
              <div className="field" key={k}>
                <label htmlFor={`-crm-users-${k}`}>{l}</label>
                <input id={`-crm-users-${k}`} name={k}
                  required={k !== "phone"}
                  autoComplete={k === "password" ? "new-password" : k === "email" ? "email" : k === "name" ? "name" : "tel"}
                  type={t}
                  value={f[k]}
                  onChange={(e) => setF({ ...f, [k]: e.target.value })}
                />
              </div>
            ))}
            <div className="field full">
              <label htmlFor="-crm-users-role">Role</label>
              <select id="-crm-users-role" name="-crm-users-role"
                value={f.role}
                onChange={(e) => setF({ ...f, role: e.target.value })}
              >
                {[
                  "ADMIN",
                  "SALES_MANAGER",
                  "SALES_EXECUTIVE",
                  "ACCOUNTS",
                  "VIEWER",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
            <button className="btn full">Create User</button>
          </form>
        </Modal>
      )}
    </>
  );
}
