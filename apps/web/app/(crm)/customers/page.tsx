"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import Topbar from "@/components/Topbar";
import Modal from "@/components/Modal";
import { api } from "@/lib/api";
const init = {
  name: "",
  phone: "",
  email: "",
  occupation: "",
  nrbCountry: "",
  address: "",
  notes: "",
};
export default function Customers() {
  const [list, setList] = useState<any[]>([]),
    [open, setOpen] = useState(false),
    [f, setF] = useState<any>(init),
    [err, setErr] = useState(""),
    [q, setQ] = useState("");
  const load = useCallback((query = "") =>
    api<any[]>("/customers" + (query ? `?q=${encodeURIComponent(query)}` : ""))
      .then(setList)
      .catch((e) => setErr(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/customers", {
        method: "POST",
        body: JSON.stringify({
          ...f,
          email: f.email || undefined,
          occupation: f.occupation || undefined,
          nrbCountry: f.nrbCountry || undefined,
          address: f.address || undefined,
          notes: f.notes || undefined,
        }),
      });
      setOpen(false);
      setF(init);
      load(q);
    } catch (e: any) {
      setErr(e.message);
    }
  }
  return (
    <>
      <Topbar
        title="Customers"
        action={
          <button className="btn" onClick={() => setOpen(true)}>
            <Icon name="plus" size={16} /> New Customer
          </button>
        }
      />
      {err && <div className="error">{err}</div>}
      <div className="card">
        <div className="toolbar">
          <div className="filters">
            <input
              aria-label="Search customers" name="customer-search" placeholder="Search customer"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="btn secondary" onClick={() => load(q)}>
              <Icon name="search" size={15} /> Search
            </button>
          </div>
          <div className="muted">{list.length} customers</div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Occupation</th>
                <th>NRB Country</th>
                <th>Bookings</th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id}>
                  <td>
                    <b>{x.name}</b>
                  </td>
                  <td>{x.phone}</td>
                  <td>{x.email || "—"}</td>
                  <td>{x.occupation || "—"}</td>
                  <td>{x.nrbCountry || "—"}</td>
                  <td>{x._count?.bookings || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {open && (
        <Modal title="Create Customer" onClose={() => setOpen(false)}>
          <form onSubmit={save} className="form-grid">
            {[
              ["Name", "name"],
              ["Phone", "phone"],
              ["Email", "email"],
              ["Occupation", "occupation"],
              ["NRB Country", "nrbCountry"],
              ["Address", "address"],
            ].map(([l, k]) => (
              <div className="field" key={k}>
                <label htmlFor={`-crm-customers-${k}`}>{l}</label>
                <input id={`-crm-customers-${k}`} name={k}
                  required={k === "name" || k === "phone"}
                  value={f[k]}
                  onChange={(e) => setF({ ...f, [k]: e.target.value })}
                />
              </div>
            ))}
            <div className="field full">
              <label htmlFor="-crm-customers-notes">Notes</label>
              <textarea id="-crm-customers-notes" name="-crm-customers-notes"
                rows={3}
                value={f.notes}
                onChange={(e) => setF({ ...f, notes: e.target.value })}
              />
            </div>
            <button className="btn full">Save Customer</button>
          </form>
        </Modal>
      )}
    </>
  );
}
