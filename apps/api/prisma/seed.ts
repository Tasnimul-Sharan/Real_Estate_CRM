import { PrismaClient, LeadSource, LeadStatus, PlotStatus, Priority, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.SEED_DEMO !== 'true' || process.env.NODE_ENV === 'production') throw new Error('Demo seeding requires SEED_DEMO=true outside production');
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 16) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (16+ characters)');
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL },
    update: {},
    create: { name: 'CRM Administrator', email: process.env.ADMIN_EMAIL, passwordHash, role: Role.SUPER_ADMIN },
  });

  const project = await prisma.project.upsert({
    where: { code: 'DEMO-01' },
    update: {},
    create: { name: 'Demo Township', code: 'DEMO-01', location: 'Purbachal, Dhaka', description: 'Sample project created by seed.' },
  });
  const block = await prisma.block.upsert({
    where: { projectId_name: { projectId: project.id, name: 'Block A' } },
    update: {},
    create: { projectId: project.id, name: 'Block A' },
  });
  for (const p of [
    { plotNo: 'A-101', sizeKatha: 5, pricePerKatha: 1800000 },
    { plotNo: 'A-102', sizeKatha: 5, pricePerKatha: 1850000 },
    { plotNo: 'A-103', sizeKatha: 10, pricePerKatha: 1750000 },
  ]) {
    await prisma.plot.upsert({
      where: { projectId_plotNo: { projectId: project.id, plotNo: p.plotNo } },
      update: {},
      create: { projectId: project.id, blockId: block.id, plotNo: p.plotNo, sizeKatha: p.sizeKatha, pricePerKatha: p.pricePerKatha, totalPrice: p.sizeKatha * p.pricePerKatha, status: PlotStatus.AVAILABLE, roadWidthFt: 25 },
    });
  }
  const existing = await prisma.lead.findFirst({ where: { phone: '01700000000' } });
  if (!existing) await prisma.lead.create({ data: { name: 'Sample Lead', phone: '01700000000', source: LeadSource.FACEBOOK, status: LeadStatus.NEW, priority: Priority.HIGH, assignedToId: admin.id, preferredProjectId: project.id, budget: 10000000 } });
}

main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
