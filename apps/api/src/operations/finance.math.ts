import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
export const decimal = (v: any = 0) => new Prisma.Decimal(v);
export const sum = (items: any[], key = 'amount') => items.reduce((n, item) => n.plus(item[key]), decimal());
export const todayDhaka = () => new Date(Date.now() + 21600000).toISOString().slice(0, 10);
export function dateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) throw new BadRequestException('Use a valid date in YYYY-MM-DD format');
  return value;
}
export function monthDate(start: string, offset: number) {
  const [year, month, day] = dateOnly(start).split('-').map(Number);
  const last = new Date(Date.UTC(year, month + offset, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + offset, Math.min(day, last)));
}
export function schedule(total: number, down: number, count: number, downDate: string, firstDate: string) {
  dateOnly(downDate); dateOnly(firstDate);
  const price = decimal(total), deposit = decimal(down), balance = price.minus(deposit);
  if (deposit.gt(price)) throw new BadRequestException('Down payment cannot exceed the agreed sale price');
  if (balance.gt(0) && (!count || balance.mul(100).lt(count))) throw new BadRequestException('Each installment must be at least BDT 0.01');
  if (balance.gt(0) && firstDate < downDate) throw new BadRequestException('First installment cannot precede the down payment date');
  const rows: { sequence: number; label: string; dueDate: Date; amount: Prisma.Decimal }[] = [];
  if (deposit.gt(0)) rows.push({ sequence: 0, label: 'Down payment', dueDate: new Date(downDate), amount: deposit });
  if (balance.gt(0)) {
    const regular = balance.div(count).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
    for (let i=0;i<count;i++) rows.push({ sequence:i+1, label:`Installment ${i+1}`, dueDate:monthDate(firstDate,i), amount:i===count-1 ? balance.minus(regular.mul(count-1)) : regular });
  }
  return rows;
}
export function ledger(booking: any, asOf = todayDhaka()) {
  const paid = sum(booking.payments), plan = booking.paymentPlan;
  if (!plan) return { paid:paid.toFixed(2), total:null, outstanding:null, overdue:'0.00', dueToday:'0.00', credit:'0.00', installments:[] };
  let remaining = paid, overdue = decimal(), dueToday = decimal();
  const installments = plan.installments.map((row:any) => {
    const applied = Prisma.Decimal.min(remaining, row.amount);
    remaining = remaining.minus(applied);
    const outstanding = decimal(row.amount).minus(applied), dueDate = row.dueDate.toISOString().slice(0,10);
    if (booking.status !== 'CANCELLED' && dueDate < asOf) overdue = overdue.plus(outstanding);
    if (booking.status !== 'CANCELLED' && dueDate === asOf) dueToday = dueToday.plus(outstanding);
    return { ...row, dueDate, amount:decimal(row.amount).toFixed(2), paid:applied.toFixed(2), outstanding:outstanding.toFixed(2), status:booking.status==='CANCELLED'?'CANCELLED':outstanding.eq(0)?'PAID':dueDate<asOf?'OVERDUE':dueDate===asOf?'DUE_TODAY':applied.gt(0)?'PARTIAL':'UPCOMING' };
  });
  return { total:plan.totalPrice.toFixed(2), paid:paid.toFixed(2), outstanding:booking.status==='CANCELLED'?'0.00':Prisma.Decimal.max(decimal(plan.totalPrice).minus(paid),0).toFixed(2), overdue:overdue.toFixed(2), dueToday:dueToday.toFixed(2), credit:Prisma.Decimal.max(paid.minus(plan.totalPrice),0).toFixed(2), installments };
}
