"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { usePermissions } from "@/lib/permissions";
import Topbar from "@/components/Topbar";
import Modal from "@/components/Modal";
import { api, money } from "@/lib/api";
export default function Payments() {
  const permissions = usePermissions();
  const [list, setList] = useState<any[]>([]),
    [bookings, setBookings] = useState<any[]>([]),
    [open, setOpen] = useState(false),
    [f, setF] = useState<any>({
      bookingId: "",
      amount: "",
      method: "BANK_TRANSFER",
      referenceNo: "",
      note: "",
    }),
    [err, setErr] = useState("");
  const load = useCallback(() =>
    api<any[]>("/payments")
      .then(setList)
      .catch((e) => setErr(e.message)), []);
  useEffect(() => {
    load();
    api<any[]>("/bookings").then((x) => {
      const active = x.filter((b: any) => b.status !== "CANCELLED");
      setBookings(active);
      setF((v: any) => ({ ...v, bookingId: active[0]?.id || "" }));
    }).catch((e) => setErr(e.message));
  }, [load]);
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/payments", {
        method: "POST",
        body: JSON.stringify({
          ...f,
          amount: Number(f.amount),
          referenceNo: f.referenceNo || undefined,
          note: f.note || undefined,
        }),
      });
      setOpen(false);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }
  return (
    <>
      <Topbar
        title="Payments"
        action={permissions.payments && (
          <button className="btn" onClick={() => setOpen(true)}>
            <Icon name="plus" size={16} /> Record Payment
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
                <th>Project / Plot</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id}>
                  <td>{new Date(x.paymentDate).toLocaleDateString()}</td>
                  <td>
                    <b>{x.booking.customer.name}</b>
                  </td>
                  <td>
                    {x.booking.plot.project.name} · {x.booking.plot.plotNo}
                  </td>
                  <td>{money(x.amount)}</td>
                  <td>{x.method}</td>
                  <td>{x.referenceNo || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {open && (
        <Modal title="Record Payment" onClose={() => setOpen(false)}>
          {err && <div className="error" role="alert">{err}</div>}
          <form className="form-grid" onSubmit={save}>
            <div className="field full">
              <label htmlFor="-crm-payments-booking">Booking</label>
              <select id="-crm-payments-booking" name="-crm-payments-booking"
                required
                value={f.bookingId}
                onChange={(e) => setF({ ...f, bookingId: e.target.value })}
              >
                {bookings.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.customer.name} · {x.plot.project.name}/{x.plot.plotNo}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="-crm-payments-amount">Amount</label>
              <input id="-crm-payments-amount" name="-crm-payments-amount"
                required
                type="number" min="0.01" step="0.01"
                value={f.amount}
                onChange={(e) => setF({ ...f, amount: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="-crm-payments-method">Method</label>
              <select id="-crm-payments-method" name="-crm-payments-method"
                value={f.method}
                onChange={(e) => setF({ ...f, method: e.target.value })}
              >
                {[
                  "CASH",
                  "BANK_TRANSFER",
                  "CHEQUE",
                  "CARD",
                  "MOBILE_BANKING",
                  "OTHER",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="-crm-payments-reference-no">Reference No</label>
              <input id="-crm-payments-reference-no" name="-crm-payments-reference-no"
                value={f.referenceNo}
                onChange={(e) => setF({ ...f, referenceNo: e.target.value })}
              />
            </div>
            <div className="field full">
              <label htmlFor="-crm-payments-note">Note</label>
              <textarea id="-crm-payments-note" name="-crm-payments-note"
                rows={2}
                value={f.note}
                onChange={(e) => setF({ ...f, note: e.target.value })}
              />
            </div>
            <button className="btn full" disabled={!bookings.length}>
              Save Payment
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
