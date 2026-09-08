import { RolesGuard } from "../common/roles.guard";
import { Roles } from "../common/roles.decorator";
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
@UseGuards(AuthGuard, RolesGuard)
@Controller("bookings")
export class BookingsController {
  constructor(private s: BookingsService) {}
  @Get() list() {
    return this.s.list();
  }
  @Get(":id") one(@Param("id") id: string) {
    return this.s.one(id);
  }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SALES_MANAGER, Role.SALES_EXECUTIVE)
  @Post()
  create(@CurrentUser() u: AuthUser, @Body() d: CreateBookingDto) {
    return this.s.create(u.sub, d);
  }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SALES_MANAGER, Role.SALES_EXECUTIVE)
  @Patch(":id")
  update(@Param("id") id: string, @Body() d: UpdateBookingDto) {
    return this.s.update(id, d);
  }
}
