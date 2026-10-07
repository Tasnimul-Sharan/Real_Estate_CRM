import { PermissionGuard, RequirePermissions } from '../access/permission.guard';
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
import { UsersService } from "./users.service";
import { CreateUserDto, UpdateUserDto } from "./dto/user.dto";
@ApiTags("users")
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller("users")
export class UsersController {
  constructor(private s: UsersService) {}
  @RequirePermissions('users.view') @Get() list() {
    return this.s.list();
  }
  @RequirePermissions('users.create') @Post() create(
    @Body() d: CreateUserDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.s.create(d, u);
  }
  @RequirePermissions('users.edit') @Patch(":id") update(
    @Param("id") id: string,
    @Body() d: UpdateUserDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.s.update(id, d, u);
  }
}
