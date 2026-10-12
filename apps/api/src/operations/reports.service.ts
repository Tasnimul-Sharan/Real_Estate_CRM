import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportQuery } from './operations.dto';
import { dateOnly, decimal, ledger, sum, todayDhaka } from './finance.math';
import { financeInclude, sums } from './finance.service';
@Injectable()
export class ReportsService {
  constructor(private p:PrismaService) {}
  async summary(q:ReportQuery) {
    dateOnly(q.from);dateOnly(q.to);
    const start=new Date(`${q.from}T00:00:00+06:00`),end=new Date(new Date(`${q.to}T00:00:00+06:00`).getTime()+86400000);
    if(start>=end || end.getTime()-start.getTime()>366*86400000) throw new BadRequestException('Choose a date range of up to 366 days');
    const project=q.projectId?{plot:{projectId:q.projectId}}:{};
    const [bookings,payments,portfolio,leads]=await this.p.$transaction([
      this.p.booking.findMany({where:{...project,bookedAt:{gte:start,lt:end},status:{not:'CANCELLED'}},include:financeInclude}),
      this.p.payment.findMany({where:{paymentDate:{gte:start,lt:end},booking:{...project,status:{not:'CANCELLED'}}},include:{booking:{include:{plot:{include:{project:true}},salesUser:{select:{id:true,name:true}}}}}}),
      this.p.booking.findMany({where:{...project,status:{not:'CANCELLED'}},include:financeInclude}),
      this.p.lead.findMany({where:{createdAt:{gte:start,lt:end},...(q.projectId?{preferredProjectId:q.projectId}:{})},select:{status:true}}),
    ],{isolationLevel:'RepeatableRead'});
    const months=new Map<string,any>();
    const month=(date:Date)=>{const key=new Date(date.getTime()+21600000).toISOString().slice(0,7); if(!months.has(key)) months.set(key,{month:key,bookings:0,bookingAmount:decimal(),collections:decimal()});return months.get(key);};
    const people=new Map<string,any>();
    const person=(u:any)=>{if(!people.has(u.id))people.set(u.id,{id:u.id,name:u.name,bookings:0,bookingAmount:decimal(),collections:decimal()});return people.get(u.id);};
    for(const b of bookings) {const m=month(b.bookedAt),p=person(b.salesUser);m.bookings++;p.bookings++;m.bookingAmount=m.bookingAmount.plus(b.bookingAmount);p.bookingAmount=p.bookingAmount.plus(b.bookingAmount);}
    for(const payment of payments) {const m=month(payment.paymentDate),p=person(payment.booking.salesUser);m.collections=m.collections.plus(payment.amount);p.collections=p.collections.plus(payment.amount);}
    const balances=portfolio.map(b=>({...b,ledger:ledger(b)}));
    const moneyRows=(rows:any[])=>rows.map(r=>({...r,bookingAmount:r.bookingAmount.toFixed(2),collections:r.collections.toFixed(2)}));
    return {from:q.from,to:q.to,asOf:todayDhaka(),timeZone:'Asia/Dhaka',totals:{bookings:bookings.length,bookingAmount:sum(bookings,'bookingAmount').toFixed(2),collections:sum(payments).toFixed(2),outstanding:sums(balances,'outstanding'),overdue:sums(balances,'overdue'),unplanned:balances.filter(b=>!b.paymentPlan).length,leads:leads.length,wonLeads:leads.filter(l=>l.status==='WON').length},months:moneyRows([...months.values()].sort((a,b)=>a.month.localeCompare(b.month))),salespeople:moneyRows([...people.values()]),collections:payments.map(p=>({id:p.id,date:p.paymentDate,amount:p.amount,method:p.method,project:p.booking.plot.project.name,plot:p.booking.plot.plotNo,salesperson:p.booking.salesUser.name}))};
  }
}
