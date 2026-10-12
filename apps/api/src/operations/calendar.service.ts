import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarQuery, CompleteFollowUpDto, FollowUpDto } from './operations.dto';
import { todayDhaka } from './finance.math';
const include={assignedTo:{select:{id:true,name:true}},preferredProject:{select:{name:true}},activities:{where:{nextFollowUpAt:{not:null}},orderBy:{createdAt:'desc' as const},take:1,select:{type:true,note:true,nextFollowUpAt:true}}};
@Injectable()
export class CalendarService {
  constructor(private p:PrismaService) {}
  async list(q:CalendarQuery) {
    const month=q.month??todayDhaka().slice(0,7);
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException('Use month YYYY-MM');
    const [year,m]=month.split('-').map(Number);
    const start=new Date(`${month}-01T00:00:00+06:00`),end=new Date(Date.UTC(year,m,1)-21600000);
    const now=new Date();
    const where={status:{notIn:['WON','LOST'] as any},...(q.assignedToId?{assignedToId:q.assignedToId}:{})};
    const [events,overdue]=await this.p.$transaction([
      this.p.lead.findMany({where:{...where,nextFollowUpAt:{gte:start,lt:end}},include,orderBy:{nextFollowUpAt:'asc'}}),
      this.p.lead.findMany({where:{...where,nextFollowUpAt:{lt:now}},include,orderBy:{nextFollowUpAt:'asc'}}),
    ]);
    return {month,timeZone:'Asia/Dhaka',events,overdue};
  }
  async save(d:FollowUpDto,actor:string) {
    if(new Date(d.scheduledAt)<=new Date()) throw new BadRequestException('Choose a future follow-up time');
    return this.p.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${d.leadId} FOR UPDATE`;
      const lead=await tx.lead.findUnique({where:{id:d.leadId}});
      if(!lead) throw new NotFoundException('Lead not found');
      if(lead.updatedAt.toISOString()!==new Date(d.expectedUpdatedAt).toISOString()) throw new ConflictException('This lead changed. Refresh before scheduling.');
      if(['WON','LOST'].includes(lead.status)) throw new ConflictException('Reopen this lead before scheduling a follow-up');
      if(d.assignedToId && !await tx.user.findFirst({where:{id:d.assignedToId,status:'ACTIVE'}})) throw new BadRequestException('Choose an active assignee');
      await tx.activity.create({data:{leadId:lead.id,userId:actor,type:d.type,note:d.note,nextFollowUpAt:new Date(d.scheduledAt)}});
      return tx.lead.update({where:{id:lead.id},data:{nextFollowUpAt:new Date(d.scheduledAt),...(d.assignedToId?{assignedToId:d.assignedToId}:{})}});
    });
  }
  async complete(id:string,d:CompleteFollowUpDto,actor:string) {
    return this.p.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${id} FOR UPDATE`;
      const lead=await tx.lead.findUnique({where:{id}});
      if(!lead) throw new NotFoundException('Lead not found');
      if(!lead.nextFollowUpAt || lead.updatedAt.toISOString()!==new Date(d.expectedUpdatedAt).toISOString()) throw new ConflictException('Follow-up changed or is already complete. Refresh and try again.');
      await tx.activity.create({data:{leadId:id,userId:actor,type:'NOTE',note:`Follow-up completed (${lead.nextFollowUpAt.toISOString()}): ${d.note}`}});
      return tx.lead.update({where:{id},data:{nextFollowUpAt:null}});
    });
  }
}
