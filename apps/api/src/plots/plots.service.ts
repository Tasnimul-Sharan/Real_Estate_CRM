import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, PlotStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlotDto, UpdatePlotDto } from './dto/plot.dto';

@Injectable()
export class PlotsService {
  constructor(private p: PrismaService) {}
  list(projectId?: string, status?: PlotStatus) { return this.p.plot.findMany({ where: { ...(projectId ? { projectId } : {}), ...(status ? { status } : {}) }, include: { project: true, block: true }, orderBy: [{ projectId: 'asc' }, { plotNo: 'asc' }] }); }
  async one(id: string) {
    const plot = await this.p.plot.findUnique({ where: { id }, include: { project: true, block: true, bookings: { include: { customer: true, payments: true } } } });
    if (!plot) throw new NotFoundException('Plot not found');
    return plot;
  }
  async create(d: CreatePlotDto) {
    if (d.status === PlotStatus.BOOKED || d.status === PlotStatus.SOLD) throw new BadRequestException('Use a booking to mark a plot booked or sold');
    if (d.blockId && !await this.p.block.findFirst({ where: { id: d.blockId, projectId: d.projectId } })) throw new BadRequestException('Block must belong to the selected project');
    try { return await this.p.plot.create({ data: { ...d, totalPrice: new Prisma.Decimal(d.sizeKatha).mul(d.pricePerKatha) } }); }
    catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Plot number already exists');
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') throw new BadRequestException('Project or block not found');
      throw e;
    }
  }
  async update(id: string, d: UpdatePlotDto) {
    return this.p.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Plot" WHERE id = ${id} FOR UPDATE`;
      const plot = await tx.plot.findUnique({ where: { id } });
      if (!plot) throw new NotFoundException('Plot not found');
      const booking = await tx.booking.findFirst({ where: { plotId: id, status: { not: BookingStatus.CANCELLED } } });
      if (d.status && d.status !== plot.status && (booking || d.status === PlotStatus.BOOKED || d.status === PlotStatus.SOLD)) throw new ConflictException('Change the booking status to update reserved inventory');
      if (booking && (d.sizeKatha !== undefined || d.pricePerKatha !== undefined)) throw new ConflictException('Price and size cannot change while a booking owns this plot');
      if (d.blockId && !await tx.block.findFirst({ where: { id: d.blockId, projectId: plot.projectId } })) throw new BadRequestException('Block must belong to the selected project');
      return tx.plot.update({ where: { id }, data: { ...d, totalPrice: new Prisma.Decimal(d.sizeKatha ?? plot.sizeKatha).mul(d.pricePerKatha ?? plot.pricePerKatha) } });
    });
  }
}
