"use client";
import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Topbar from '@/components/Topbar';
import Icon from '@/components/Icon';
import { api } from '@/lib/api';
import { usePermissions } from '@/lib/permissions';
import { amount, dhakaDate, Empty, Metric } from '@/components/OperationsUI';
export default function Installments(){
 const {can}=usePermissions();const [rows,setRows]=useState<any[]>([]),[selected,setSelected]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false);
 const [form,setForm]=useState({totalPrice:'',downPayment:'0',months:'12',downPaymentDate:dhakaDate(),firstInstallmentDate:dhakaDate()});
 const load=useCallback(async()=>{try{setRows(await api('/installments'));setLoaded(true);setError('')}catch(e:any){setError(e.message)}},[]);
 useEffect(()=>{load()},[load]);
 const booking=rows.find(b=>b.id===selected),active=rows.filter(b=>b.status!=='CANCELLED');
 const total=(key:string)=>active.reduce((n,b)=>n+Number(b.ledger[key]??0),0);
 function choose(id:string){setSelected(id);const b=rows.find(x=>x.id===id);setForm(f=>({...f,totalPrice:b?.plot.totalPrice??''}));setError('')}
 async function save(e:FormEvent){e.preventDefault();const fields=new FormData(e.currentTarget as HTMLFormElement);const dates={downPaymentDate:String(fields.get("downPaymentDate")),firstInstallmentDate:String(fields.get("firstInstallmentDate"))};setBusy(true);setError('');try{await api('/installments',{method:'POST',body:JSON.stringify({...form,...dates,bookingId:selected,totalPrice:Number(form.totalPrice),downPayment:Number(form.downPayment),months:Number(form.months)})});await load()}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <><Topbar title="Installments & Dues"/><div className="ops-metrics"><Metric label="Agreed sale value" value={amount(total('total'))}/><Metric label="Outstanding" value={amount(total('outstanding'))}/><Metric label="Overdue" value={amount(total('overdue'))} note="Unpaid installments before today"/><Metric label="Due today" value={amount(total('dueToday'))}/></div>
 <p className="muted">Balances cover payment plans on active bookings. {active.filter(b=>!b.paymentPlan).length} booking(s) still need an agreed sale price and plan. Dates use Asia/Dhaka.</p>
 {error&&<div className="error" role="alert">{error}</div>}
 <section className="card"><div className="section-title"><div><h2>Payment plans</h2><p>Select a booking to view or set up its installments.</p></div><button className="btn secondary" onClick={load}>Refresh balances</button></div>
 <div className="field"><label htmlFor="plan-booking">Booking</label><select id="plan-booking" value={selected} onChange={e=>choose(e.target.value)}><option value="">Choose a booking</option>{rows.map(b=><option key={b.id} value={b.id}>{b.customer.name} · {b.plot.project.name} / {b.plot.plotNo} · {b.paymentPlan?'Plan ready':'No plan'} · {b.status}</option>)}</select></div>
 {!loaded?<Empty>Loading bookings…</Empty>:!rows.length?<Empty>Create a booking first to set up a payment plan.</Empty>:!booking?<Empty>Select a booking above.</Empty>:<>
 <div className="ops-summary"><span>Recorded payments <b>{amount(booking.ledger.paid)}</b></span><span>Booking amount <b>{amount(booking.bookingAmount)}</b></span><span>Status <b>{booking.status}</b></span>{can('statements.view')&&<Link className="text-link" href={`/statements?customer=${booking.customerId}`}>Customer statement <Icon name="arrow" size={16}/></Link>}</div>
 {!booking.paymentPlan?can('installments.create')&&['CONFIRMED','COMPLETED'].includes(booking.status)?<form key={selected} onSubmit={save} className="form-grid ops-plan-form">
 <div className="field"><label htmlFor="plan-total">Agreed sale price (BDT)</label><input id="plan-total" type="number" min="0.01" max="1000000000000" step="0.01" required value={form.totalPrice} onChange={e=>setForm({...form,totalPrice:e.target.value})}/></div>
 <div className="field"><label htmlFor="plan-down">Scheduled down payment (BDT)</label><input id="plan-down" type="number" min="0" step="0.01" required value={form.downPayment} onChange={e=>setForm({...form,downPayment:e.target.value})}/></div>
 <div className="field"><label htmlFor="plan-down-date">Down payment due date</label><input id="plan-down-date" name="downPaymentDate" type="date" required defaultValue={form.downPaymentDate}/></div>
 <div className="field"><label htmlFor="plan-first">First monthly installment</label><input id="plan-first" name="firstInstallmentDate" type="date" required defaultValue={form.firstInstallmentDate}/></div>
 <div className="field"><label htmlFor="plan-months">Number of monthly installments</label><input id="plan-months" type="number" min={Number(form.downPayment)>=Number(form.totalPrice)?0:1} max="360" required value={form.months} onChange={e=>setForm({...form,months:e.target.value})}/></div>
 <p className="muted full">Confirm the agreed price before saving. A plan does not record a payment. Existing and new payments are applied to the earliest installments first. Monthly dates keep the original day, using month-end where needed. The last installment includes any rounding difference. Saved plans are fixed.</p>
 <button className="btn full" disabled={busy}>{busy?'Saving…':'Create payment plan'}</button></form>:<Empty>No payment plan. An authorized user can create one after the booking is confirmed.</Empty>:<>
 <div className="ops-summary"><span>Agreed price <b>{amount(booking.ledger.total)}</b></span><span>Remaining <b>{amount(booking.ledger.outstanding)}</b></span><span>Overdue <b>{amount(booking.ledger.overdue)}</b></span>{can('payments.create')&&<Link href="/payments" className="btn">Record payment</Link>}</div>
 <div className="table-wrap"><table className="table"><thead><tr><th>Installment</th><th>Due date</th><th>Amount</th><th>Paid</th><th>Remaining</th><th>Status</th></tr></thead><tbody>{booking.ledger.installments.map((i:any)=><tr key={i.id}><td>{i.label}</td><td>{i.dueDate}</td><td>{amount(i.amount)}</td><td>{amount(i.paid)}</td><td>{amount(i.outstanding)}</td><td><span className={`badge ${i.status}`}>{i.status.replaceAll('_',' ')}</span></td></tr>)}</tbody></table></div></>}
 </>}</section>
 <section className="card ops-section"><h2>Outstanding by booking</h2><div className="table-wrap"><table className="table"><thead><tr><th>Customer / plot</th><th>Agreed price</th><th>Paid</th><th>Outstanding</th><th>Overdue</th><th>Plan</th></tr></thead><tbody>{active.map(b=><tr key={b.id}><td>{b.customer.name}<small className="ops-subtext">{b.plot.project.name} / {b.plot.plotNo}</small></td><td>{b.paymentPlan?amount(b.ledger.total):'Not set'}</td><td>{amount(b.ledger.paid)}</td><td>{b.paymentPlan?amount(b.ledger.outstanding):'Not calculated'}</td><td>{b.paymentPlan?amount(b.ledger.overdue):'—'}</td><td><button className="btn secondary" onClick={()=>choose(b.id)}>View plan</button></td></tr>)}</tbody></table></div>{loaded&&!active.length&&<Empty>No active bookings yet.</Empty>}</section></>;
}
