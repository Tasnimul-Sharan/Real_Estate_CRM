import { CurrentUser } from "../common/current-user.decorator";
import { AuthUser } from "../common/auth-user.interface";
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
import { Role } from "@prisma/client";
import { AuthGuard } from "../common/auth.guard";
import { RolesGuard } from "../common/roles.guard";
import { Roles } from "../common/roles.decorator";
import { UsersService } from "./users.service";
import { CreateUserDto, UpdateUserDto } from "./dto/user.dto";
@ApiTags("users")
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller("users")
export class UsersController {
  constructor(private s: UsersService) {}
  @Get() list() {
    return this.s.list();
  }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Post() create(
    @Body() d: CreateUserDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.s.create(d, u);
  }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Patch(":id") update(
    @Param("id") id: string,
    @Body() d: UpdateUserDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.s.update(id, d, u);
  }
}
