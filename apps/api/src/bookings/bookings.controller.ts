import { PermissionGuard, RequirePermissions } from '../access/permission.guard';
import { Role } from "@prisma/client";
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../common/auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { AuthUser } from "../common/auth-user.interface";
import { BookingsService } from "./bookings.service";
import { CreateBookingDto, UpdateBookingDto } from "./dto/booking.dto";
@ApiTags("bookings")
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller("bookings")
export class BookingsController {
  constructor(private s: BookingsService) {}
  @RequirePermissions('bookings.view') @Get() list() {
    return this.s.list();
  }
  @RequirePermissions('bookings.view') @Get(":id") one(@Param("id") id: string) {
    return this.s.one(id);
  }
  @RequirePermissions('bookings.create') @Post()
  create(@CurrentUser() u: AuthUser, @Body() d: CreateBookingDto) {
    return this.s.create(u.sub, d);
  }
  @RequirePermissions('bookings.edit') @Patch(":id")
  update(@Param("id") id: string, @Body() d: UpdateBookingDto) {
    return this.s.update(id, d);
  }
}
