import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlanDto } from './operations.dto';
import { decimal, ledger, schedule, sum, todayDhaka } from './finance.math';
export const financeInclude = { customer:true, plot:{include:{project:true}}, salesUser:{select:{id:true,name:true}}, payments:{orderBy:[{paymentDate:'asc' as const},{id:'asc' as const}]}, paymentPlan:{include:{installments:{orderBy:{sequence:'asc' as const}}}} };
@Injectable()
export class FinanceService {
  constructor(private p:PrismaService) {}
  async list() {
    const rows=await this.p.booking.findMany({include:financeInclude,orderBy:{bookedAt:'desc'}});
    return rows.map(b=>({...b,ledger:ledger(b)}));
  }
  async create(dto:PlanDto,actor:string) {
    const rows=schedule(dto.totalPrice,dto.downPayment,dto.months,dto.downPaymentDate,dto.firstInstallmentDate);
    return this.p.$transaction(async tx=>{
      const ref=await tx.booking.findUnique({where:{id:dto.bookingId},select:{plotId:true}});
      if(!ref) throw new NotFoundException('Booking not found');
      await tx.$queryRaw`SELECT id FROM "Plot" WHERE id = ${ref.plotId} FOR UPDATE`;
      const b=await tx.booking.findUniqueOrThrow({where:{id:dto.bookingId},include:{payments:true,paymentPlan:true}});
      if(!['CONFIRMED','COMPLETED'].includes(b.status)) throw new ConflictException('Confirm the booking before creating a payment plan');
      if(b.paymentPlan) throw new ConflictException('This booking already has a payment plan');
      if(sum(b.payments).gt(dto.totalPrice)) throw new ConflictException('Agreed sale price cannot be less than payments already recorded');
      return tx.paymentPlan.create({data:{bookingId:b.id,totalPrice:dto.totalPrice,createdById:actor,installments:{create:rows}},include:{installments:{orderBy:{sequence:'asc'}}}});
    });
  }
  async statement(id:string) {
    const c=await this.p.customer.findUnique({where:{id},include:{bookings:{include:financeInclude,orderBy:{bookedAt:'asc'}}}});
    if(!c) throw new NotFoundException('Customer not found');
    const bookings=c.bookings.map(b=>({...b,ledger:ledger(b)}));
    return {customer:{id:c.id,name:c.name,phone:c.phone,email:c.email,address:c.address},asOf:todayDhaka(),bookings,
      totals:{agreed:sums(bookings.filter(b=>b.status!=='CANCELLED'),'total'),paid:sums(bookings,'paid'),outstanding:sums(bookings,'outstanding'),overdue:sums(bookings,'overdue')},
      unplanned:bookings.filter(b=>!b.paymentPlan && b.status!=='CANCELLED').length};
  }
  async receipt(id:string) {
    const payment=await this.p.payment.findUnique({where:{id},include:{booking:{include:{customer:true,plot:{include:{project:true}}}}}});
    if(!payment) throw new NotFoundException('Payment not found');
    return {...payment,receiptNo:`AHS-${payment.id.toUpperCase()}`,issuedAt:payment.createdAt};
  }
}
export function sums(rows:any[],field:string) { return rows.reduce((n,b)=>n.plus(b.ledger[field]??0),decimal()).toFixed(2); }
