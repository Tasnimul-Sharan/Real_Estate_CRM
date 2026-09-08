import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, PlotStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto, UpdateBookingDto } from './dto/booking.dto';

const details = { plot: { include: { project: true } }, customer: true, salesUser: { select: { name: true } }, payments: true };
const transitions: Record<BookingStatus, BookingStatus[]> = {
  PENDING: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
  CONFIRMED: [BookingStatus.PENDING, BookingStatus.CANCELLED, BookingStatus.COMPLETED],
  CANCELLED: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
  COMPLETED: [],
};

@Injectable()
export class BookingsService {
  constructor(private p: PrismaService) {}
  list() { return this.p.booking.findMany({ include: details, orderBy: { createdAt: 'desc' } }); }
  async one(id: string) {
    const booking = await this.p.booking.findUnique({ where: { id }, include: details });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }
  async create(userId: string, d: CreateBookingDto) {
    return this.p.$transaction(async tx => {
      // All inventory, booking and payment mutations lock the plot first.
      await tx.$queryRaw`SELECT id FROM "Plot" WHERE id = ${d.plotId} FOR UPDATE`;
      const plot = await tx.plot.findUnique({ where: { id: d.plotId } });
      if (!plot) throw new NotFoundException('Plot not found');
      if (plot.status !== PlotStatus.AVAILABLE || await tx.booking.findFirst({ where: { plotId: plot.id, status: { not: BookingStatus.CANCELLED } } })) {
        throw new ConflictException('Plot is not available');
      }
      if (!await tx.customer.findUnique({ where: { id: d.customerId } })) throw new BadRequestException('Customer not found');
      const booking = await tx.booking.create({ data: { plotId: plot.id, customerId: d.customerId, salesUserId: userId, bookingAmount: new Prisma.Decimal(d.bookingAmount), notes: d.notes } });
      await tx.plot.update({ where: { id: plot.id }, data: { status: PlotStatus.BOOKED } });
      return booking;
    });
  }
  async update(id: string, d: UpdateBookingDto) {
    return this.p.$transaction(async tx => {
      const ref = await tx.booking.findUnique({ where: { id }, select: { plotId: true } });
      if (!ref) throw new NotFoundException('Booking not found');
      await tx.$queryRaw`SELECT id FROM "Plot" WHERE id = ${ref.plotId} FOR UPDATE`;
      const booking = await tx.booking.findUniqueOrThrow({ where: { id }, include: { payments: true, plot: true } });
      if (d.status && d.status !== booking.status) {
        if (!transitions[booking.status].includes(d.status)) throw new BadRequestException(`Cannot change ${booking.status} to ${d.status}`);
        if (d.status === BookingStatus.CANCELLED && booking.payments.length) throw new ConflictException('A booking with payments cannot be cancelled. Resolve its payments first.');
        if (booking.status === BookingStatus.CANCELLED) {
          const occupied = await tx.booking.findFirst({ where: { plotId: booking.plotId, id: { not: id }, status: { not: BookingStatus.CANCELLED } } });
          if (booking.plot.status !== PlotStatus.AVAILABLE || occupied) throw new ConflictException('Plot is no longer available for this booking');
        }
        await tx.plot.update({ where: { id: booking.plotId }, data: { status: d.status === BookingStatus.CANCELLED ? PlotStatus.AVAILABLE : d.status === BookingStatus.COMPLETED ? PlotStatus.SOLD : PlotStatus.BOOKED } });
      }
      return tx.booking.update({ where: { id }, data: d });
    });
  }
}
