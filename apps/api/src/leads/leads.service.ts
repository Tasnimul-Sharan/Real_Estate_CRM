import { Injectable, NotFoundException } from '@nestjs/common'; import { LeadStatus } from '@prisma/client'; import { PrismaService } from '../prisma/prisma.service'; import { CreateLeadDto, UpdateLeadDto } from './dto/lead.dto';
@Injectable() export class LeadsService{constructor(private p:PrismaService){} async convert(id:string) {
  return this.p.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${id} FOR UPDATE`;
    const lead = await tx.lead.findUnique({where:{id}});
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.customerId) return tx.customer.findUniqueOrThrow({where:{id:lead.customerId}});
    const customer = await tx.customer.upsert({where:{phone:lead.phone},update:{},create:{name:lead.name,phone:lead.phone,email:lead.email,source:lead.source,notes:lead.notes}});
    await tx.lead.update({where:{id},data:{customerId:customer.id}});
    return customer;
  });
} list(status?:LeadStatus,assignedToId?:string,q?:string){return this.p.lead.findMany({where:{...(status?{status}:{}),...(assignedToId?{assignedToId}:{}),...(q?{OR:[{name:{contains:q,mode:'insensitive'}},{phone:{contains:q}},{email:{contains:q,mode:'insensitive'}}]}:{})},include:{assignedTo:{select:{id:true,name:true}},preferredProject:{select:{id:true,name:true}},_count:{select:{activities:true}}},orderBy:[{priority:'desc'},{createdAt:'desc'}]})} async one(id:string){const x=await this.p.lead.findUnique({where:{id},include:{assignedTo:{select:{id:true,name:true,email:true}},preferredProject:true,customer:true,activities:{include:{user:{select:{name:true}}},orderBy:{createdAt:'desc'}}}});if(!x)throw new NotFoundException('Lead not found');return x} create(d:CreateLeadDto){return this.p.lead.create({data:{...d,nextFollowUpAt:d.nextFollowUpAt?new Date(d.nextFollowUpAt):undefined} as any})} async update(id:string,d:UpdateLeadDto){await this.one(id);return this.p.lead.update({where:{id},data:{...d,nextFollowUpAt:d.nextFollowUpAt?new Date(d.nextFollowUpAt):undefined} as any})}}
