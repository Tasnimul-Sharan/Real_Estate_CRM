import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private p: PrismaService) {}
  list(bookingId?: string) {
    return this.p.payment.findMany({ where: bookingId ? { bookingId } : undefined, include: { booking: { include: { customer: true, plot: { include: { project: true } } } } }, orderBy: { paymentDate: 'desc' } });
  }
  async create(d: CreatePaymentDto) {
    return this.p.$transaction(async tx => {
      const ref = await tx.booking.findUnique({ where: { id: d.bookingId }, select: { plotId: true } });
      if (!ref) throw new NotFoundException('Booking not found');
      await tx.$queryRaw`SELECT id FROM "Plot" WHERE id = ${ref.plotId} FOR UPDATE`;
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: d.bookingId } });
      if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.COMPLETED) throw new ConflictException('Payments require a confirmed or completed booking');
      return tx.payment.create({ data: { ...d, paymentDate: d.paymentDate ? new Date(d.paymentDate) : undefined } });
    });
  }
}
