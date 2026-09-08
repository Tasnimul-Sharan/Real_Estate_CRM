"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { usePermissions } from "@/lib/permissions";
import Topbar from "@/components/Topbar";
import Modal from "@/components/Modal";
import { api, money } from "@/lib/api";
export default function Bookings() {
  const permissions = usePermissions();
  const [selected, setSelected] = useState<any>(null);
  const [nextStatus, setNextStatus] = useState("CONFIRMED");
  const [savingStatus, setSavingStatus] = useState(false);
  const transitions: Record<string, string[]> = { PENDING: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["PENDING", "COMPLETED", "CANCELLED"], CANCELLED: ["PENDING", "CONFIRMED"], COMPLETED: [] };
  async function changeStatus(e: FormEvent) {
    e.preventDefault(); setSavingStatus(true); setErr("");
    try { await api(`/bookings/${selected.id}`, {method:"PATCH",body:JSON.stringify({status:nextStatus})}); setSelected(null); load(); refs(); }
    catch(e:any) { setErr(e.message); } finally { setSavingStatus(false); }
  }
  const [list, setList] = useState<any[]>([]),
    [plots, setPlots] = useState<any[]>([]),
    [customers, setCustomers] = useState<any[]>([]),
    [open, setOpen] = useState(false),
    [f, setF] = useState<any>({
      plotId: "",
      customerId: "",
      bookingAmount: "",
      notes: "",
    }),
    [err, setErr] = useState("");
  const load = useCallback(() =>
    api<any[]>("/bookings")
      .then(setList)
      .catch((e) => setErr(e.message)), []);
  const refs = useCallback(() => {
    api<any[]>("/plots?status=AVAILABLE").then((x) => {
      setPlots(x);
      setF((v: any) => ({ ...v, plotId: x[0]?.id || "" }));
    }).catch((e) => setErr(e.message));
    api<any[]>("/customers").then((x) => {
      setCustomers(x);
      setF((v: any) => ({ ...v, customerId: x[0]?.id || "" }));
    }).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => {
    load();
    refs();
  }, [load, refs]);
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/bookings", {
        method: "POST",
        body: JSON.stringify({
          ...f,
          bookingAmount: Number(f.bookingAmount),
          notes: f.notes || undefined,
        }),
      });
      setOpen(false);
      load();
      refs();
    } catch (e: any) {
      setErr(e.message);
    }
  }
  return (
    <>
      <Topbar
        title="Bookings"
        action={permissions.sales && (
          <button className="btn" onClick={() => setOpen(true)}>
            <Icon name="plus" size={16} /> New Booking
          </button>
        )}
      />
      {err && <div className="error">{err}</div>}
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Plot</th>
                <th>Project</th>
                <th>Booking Amount</th>
                <th>Paid</th>
                <th>Sales</th>
                <th>Status</th>
                {permissions.sales && <th>Manage</th>}
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id}>
                  <td>{new Date(x.bookedAt).toLocaleDateString()}</td>
                  <td>
                    <b>{x.customer.name}</b>
                  </td>
                  <td>{x.plot.plotNo}</td>
                  <td>{x.plot.project.name}</td>
                  <td>{money(x.bookingAmount)}</td>
                  <td>
                    {money(
                      x.payments.reduce(
                        (a: number, p: any) => a + Number(p.amount),
                        0,
                      ),
                    )}
                  </td>
                  <td>{x.salesUser.name}</td>
                  <td>
                    <span className={`badge ${x.status}`}>{x.status}</span>
                  </td>
                  {permissions.sales && <td>{transitions[x.status]?.length > 0 && <button className="btn secondary" onClick={() => {setErr("");setSelected(x);setNextStatus(transitions[x.status][0]);}}>Change status</button>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selected && <Modal title="Change booking status" onClose={() => setSelected(null)}>
        {err && <div className="error" role="alert">{err}</div>}
        <p>{selected.customer.name} · {selected.plot.plotNo}</p>
        <form onSubmit={changeStatus}>
          <div className="field"><label htmlFor="booking-next-status">New status</label><select id="booking-next-status" value={nextStatus} onChange={e => setNextStatus(e.target.value)}>{transitions[selected.status].map(status => <option key={status}>{status}</option>)}</select></div>
          <p className="muted">{nextStatus === "COMPLETED" ? "Completing this booking marks the plot sold and cannot be reversed here." : nextStatus === "CANCELLED" ? "Cancellation releases the plot. Bookings with payments cannot be cancelled." : "The plot must be available when reopening a cancelled booking."}</p>
          <button className="btn" disabled={savingStatus}>{savingStatus ? "Saving..." : "Save status"}</button>
        </form>
      </Modal>}
      {open && (
        <Modal title="Create Booking" onClose={() => setOpen(false)}>
          {err && <div className="error" role="alert">{err}</div>}
          <form className="form-grid" onSubmit={save}>
            <div className="field full">
              <label htmlFor="-crm-bookings-available-plot">Available Plot</label>
              <select id="-crm-bookings-available-plot" name="-crm-bookings-available-plot"
                required
                value={f.plotId}
                onChange={(e) => setF({ ...f, plotId: e.target.value })}
              >
                {plots.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.project.name} · {x.plotNo} · {x.sizeKatha} Katha ·{" "}
                    {money(x.totalPrice)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="-crm-bookings-customer">Customer</label>
              <select id="-crm-bookings-customer" name="-crm-bookings-customer"
                required
                value={f.customerId}
                onChange={(e) => setF({ ...f, customerId: e.target.value })}
              >
                {customers.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} · {x.phone}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="-crm-bookings-booking-amount">Booking Amount</label>
              <input id="-crm-bookings-booking-amount" name="-crm-bookings-booking-amount"
                required
                type="number" min="0.01" step="0.01"
                value={f.bookingAmount}
                onChange={(e) => setF({ ...f, bookingAmount: e.target.value })}
              />
            </div>
            <div className="field full">
              <label htmlFor="-crm-bookings-notes">Notes</label>
              <textarea id="-crm-bookings-notes" name="-crm-bookings-notes"
                rows={3}
                value={f.notes}
                onChange={(e) => setF({ ...f, notes: e.target.value })}
              />
            </div>
            <button
              className="btn full"
              disabled={!plots.length || !customers.length}
            >
              Confirm Booking
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
